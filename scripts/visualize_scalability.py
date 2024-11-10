# scripts/visualize_scalability.py

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path

class ScalabilityVisualizer:
    def __init__(self):
        print("Initializing ScalabilityVisualizer")
        self.plt_style()
        
        # Set results_dir relative to the script's location
        script_dir = Path(__file__).parent.resolve()
        self.results_dir = (script_dir / '../results').resolve()
        print(f"Resolved results directory: {self.results_dir}")

        self.output_dir = self.results_dir / 'analysis'
        self.output_dir.mkdir(parents=True, exist_ok=True)
        print(f"Output directory is set to: {self.output_dir}")
        
        # Read scalability data with exception handling
        try:
            self.scale_df = pd.read_csv(self.results_dir / 'scalability_results.csv')
            self.scale_df['Timestamp'] = pd.to_datetime(self.scale_df['Timestamp'])
            print("Successfully read 'scalability_results.csv'")
        except FileNotFoundError:
            print("Error: 'scalability_results.csv' not found in the results directory.")
            return
        except pd.errors.EmptyDataError:
            print("Error: 'scalability_results.csv' is empty.")
            return
        except Exception as e:
            print(f"An unexpected error occurred while reading 'scalability_results.csv': {e}")
            return

    def plt_style(self):
        """Set publication-quality plot style"""
        sns.set_theme(style='whitegrid')
        plt.rcParams.update({
            'font.size': 11,
            'font.family': 'serif',
            'font.serif': ['DejaVu Serif'],
            'axes.labelsize': 12,
            'axes.titlesize': 12,
            'figure.figsize': (8, 6),
            'figure.dpi': 300,
            'savefig.bbox': 'tight',
            'savefig.pad_inches': 0.1,
        })

    def plot_throughput(self):
        """Plot system throughput for different batch sizes"""
        plt.figure(figsize=(10, 6))
        
        for batch_size in self.scale_df['BatchSize'].unique():
            batch_data = self.scale_df[self.scale_df['BatchSize'] == batch_size]
            
            # Calculate throughput (devices/second)
            throughput = batch_data['ConcurrentDevices'] / (batch_data['TotalTime'] / 1000)
            
            plt.plot(batch_data['ConcurrentDevices'], throughput, 
                    marker='o', label=f'Batch Size {batch_size}')
        
        plt.title('System Throughput vs. Number of Devices')
        plt.xlabel('Number of Concurrent Devices')
        plt.ylabel('Throughput (devices/second)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig(self.output_dir / 'throughput.pdf')
        plt.close()

    def plot_response_time(self):
        """Plot average response time vs system load"""
        plt.figure(figsize=(10, 6))
        
        for batch_size in self.scale_df['BatchSize'].unique():
            batch_data = self.scale_df[self.scale_df['BatchSize'] == batch_size]
            plt.plot(batch_data['ConcurrentDevices'], 
                    batch_data['AverageResponseTime'],
                    marker='o', label=f'Batch Size {batch_size}')
        
        plt.title('Average Response Time vs. System Load')
        plt.xlabel('Number of Concurrent Devices')
        plt.ylabel('Average Response Time (ms)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig(self.output_dir / 'response_time.pdf')
        plt.close()

    def plot_success_rate_scaling(self):
        """Plot success rate vs system load"""
        plt.figure(figsize=(10, 6))
        
        for batch_size in self.scale_df['BatchSize'].unique():
            batch_data = self.scale_df[self.scale_df['BatchSize'] == batch_size]
            plt.plot(batch_data['ConcurrentDevices'], 
                    batch_data['SuccessRate'],
                    marker='o', label=f'Batch Size {batch_size}')
        
        plt.title('Success Rate vs. System Load')
        plt.xlabel('Number of Concurrent Devices')
        plt.ylabel('Success Rate (%)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig(self.output_dir / 'success_rate_scaling.pdf')
        plt.close()

    def plot_batch_efficiency(self):
        """Plot batch processing efficiency"""
        efficiency_data = self.scale_df.groupby(['BatchSize', 'ConcurrentDevices']).agg({
            'TotalTime': 'mean',
            'SuccessfulProofs': 'sum',
            'FailedProofs': 'sum'
        }).reset_index()
        
        efficiency_data['Efficiency'] = (efficiency_data['SuccessfulProofs'] * 1000) / efficiency_data['TotalTime']
        
        plt.figure(figsize=(10, 6))
        for batch_size in efficiency_data['BatchSize'].unique():
            batch_data = efficiency_data[efficiency_data['BatchSize'] == batch_size]
            plt.plot(batch_data['ConcurrentDevices'], 
                    batch_data['Efficiency'],
                    marker='o', label=f'Batch Size {batch_size}')
        
        plt.title('Batch Processing Efficiency')
        plt.xlabel('Number of Concurrent Devices')
        plt.ylabel('Successful Proofs per Second')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig(self.output_dir / 'batch_efficiency.pdf')
        plt.close()

    def generate_latex_tables(self):
        """Generate LaTeX tables for scalability results"""
        # Aggregate statistics by batch size and device count
        stats = self.scale_df.groupby(['BatchSize', 'ConcurrentDevices']).agg({
            'TotalTime': ['mean', 'std'],
            'SuccessRate': ['mean', 'std'],
            'AverageResponseTime': ['mean', 'std']
        }).round(2)

        # Generate LaTeX table
        with open(self.output_dir / 'scalability_tables.tex', 'w') as f:
            f.write(self._format_scalability_table(stats))

    def _format_scalability_table(self, stats):
        """Format scalability statistics as LaTeX table"""
        latex = """
\\begin{table}[ht]
\\centering
\\caption{System Scalability Metrics}
\\label{tab:scalability}
\\begin{tabular}{cccccc}
\\hline
Batch & Concurrent & Total Time & Success & Response \\\\
Size & Devices & (ms) & Rate (\\%) & Time (ms) \\\\
\\hline
"""
        for (batch_size, devices) in stats.index:
            row = stats.loc[(batch_size, devices)]
            latex += f"{batch_size} & {devices} & "
            latex += f"{row['TotalTime']['mean']:.2f} $\\pm$ {row['TotalTime']['std']:.2f} & "
            latex += f"{row['SuccessRate']['mean']:.2f} $\\pm$ {row['SuccessRate']['std']:.2f} & "
            latex += f"{row['AverageResponseTime']['mean']:.2f} $\\pm$ {row['AverageResponseTime']['std']:.2f} \\\\\n"
        latex += """
\\end{tabular}
\\end{table}
"""
        return latex