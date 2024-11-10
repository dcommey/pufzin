# scripts/visualize_experiments.py

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path
import os

class ExperimentVisualizer:
    def __init__(self):
        self.plt_style()
        
        # Define required filenames
        required_files = [
            'performance_results.csv',
            'reliability_results.csv',
            'memory_results.csv',
            'transaction_results.csv'
        ]
        
        # Set results_dir relative to the script's location
        script_dir = Path(__file__).parent.resolve()
        self.results_dir = (script_dir / '../results').resolve()
        print(f"Resolved results directory: {self.results_dir}")
        
        self.output_dir = self.results_dir / 'analysis'
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Check existence of required files
        for filename in required_files:
            file_path = self.results_dir / filename
            print(f"Checking for file: {file_path}")
            if not file_path.exists():
                raise FileNotFoundError(f"Required file '{file_path}' not found.")
        
        # Read data
        self.perf_df = pd.read_csv(self.results_dir / 'performance_results.csv')
        self.rel_df = pd.read_csv(self.results_dir / 'reliability_results.csv')
        self.mem_df = pd.read_csv(self.results_dir / 'memory_results.csv')
        self.tx_df = pd.read_csv(self.results_dir / 'transaction_results.csv')
        
        # Convert timestamps
        for df in [self.perf_df, self.rel_df, self.mem_df, self.tx_df]:
            df['Timestamp'] = pd.to_datetime(df['Timestamp'])
    
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

    def plot_performance_vs_noise(self):
        """Plot proof generation and verification times vs noise levels"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        # Box plots for proof generation time
        sns.boxplot(data=self.perf_df, x='NoiseLevel', y='ProofGenTime', ax=ax1)
        ax1.set_title('Proof Generation Time vs. Noise Level')
        ax1.set_xlabel('Noise Level')
        ax1.set_ylabel('Time (ms)')
        
        # Box plots for verification time
        sns.boxplot(data=self.perf_df, x='NoiseLevel', y='VerifyTime', ax=ax2)
        ax2.set_title('Verification Time vs. Noise Level')
        ax2.set_xlabel('Noise Level')
        ax2.set_ylabel('Time (ms)')
        
        plt.tight_layout()
        plt.savefig(self.output_dir / 'performance_vs_noise.pdf')
        plt.close()

    def plot_transaction_times(self):
        """Plot transaction times vs noise levels"""
        plt.figure(figsize=(8, 6))
        sns.boxplot(data=self.tx_df, x='NoiseLevel', y='TransactionTime')
        plt.title('Transaction Time vs. Noise Level')
        plt.xlabel('Noise Level')
        plt.ylabel('Transaction Time (ms)')
        plt.savefig(self.output_dir / 'transaction_time_vs_noise.pdf')
        plt.close()

    def plot_encryption_times(self):
        """Plot encryption times vs noise levels"""
        plt.figure(figsize=(8, 6))
        sns.boxplot(data=self.tx_df, x='NoiseLevel', y='EncryptionTime')
        plt.title('Encryption Time vs. Noise Level')
        plt.xlabel('Noise Level')
        plt.ylabel('Encryption Time (ms)')
        plt.savefig(self.output_dir / 'encryption_time_vs_noise.pdf')
        plt.close()

    def plot_transaction_gas_usage(self):
        """Plot gas usage for transactions"""
        plt.figure(figsize=(8, 6))
        sns.histplot(data=self.tx_df, x='GasUsed', bins=30, kde=True)
        plt.title('Distribution of Gas Usage for Transactions')
        plt.xlabel('Gas Used')
        plt.ylabel('Frequency')
        plt.savefig(self.output_dir / 'transaction_gas_usage.pdf')
        plt.close()

    def plot_success_rate(self):
        """Plot authentication success rate vs noise level"""
        success_rates = self.rel_df.groupby('NoiseLevel')['Success'].mean() * 100
        
        plt.figure(figsize=(8, 6))
        success_rates.plot(marker='o')
        plt.title('Authentication Success Rate vs. Noise Level')
        plt.xlabel('Noise Level')
        plt.ylabel('Success Rate (%)')
        plt.grid(True, alpha=0.3)
        plt.savefig(self.output_dir / 'success_rate.pdf')
        plt.close()

    def plot_gas_usage(self):
        """Plot gas usage distribution"""
        plt.figure(figsize=(8, 6))
        sns.histplot(data=self.perf_df, x='GasUsed', bins=30, kde=True)
        plt.title('Distribution of Gas Usage for Authentication')
        plt.xlabel('Gas Used')
        plt.ylabel('Frequency')
        plt.savefig(self.output_dir / 'authentication_gas_usage.pdf')
        plt.close()

    def plot_memory_usage(self):
        """Plot memory usage over time"""
        plt.figure(figsize=(10, 6))
        plt.plot(self.mem_df['Timestamp'], self.mem_df['HeapUsed'] / 1024 / 1024, label='Heap Used')
        plt.plot(self.mem_df['Timestamp'], self.mem_df['HeapTotal'] / 1024 / 1024, label='Heap Total')
        plt.title('Memory Usage Over Time')
        plt.xlabel('Time')
        plt.ylabel('Memory (MB)')
        plt.legend()
        plt.xticks(rotation=45)
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(self.output_dir / 'memory_usage.pdf')
        plt.close()

    def generate_latex_tables(self):
        """Generate LaTeX tables for the paper"""
        # Performance statistics table
        perf_stats = self.perf_df.groupby('NoiseLevel').agg({
            'ProofGenTime': ['mean', 'std', 'min', 'max'],
            'VerifyTime': ['mean', 'std', 'min', 'max'],
            'GasUsed': ['mean', 'std']
        }).round(2)

        # Reliability statistics table
        rel_stats = self.rel_df.groupby('NoiseLevel').agg({
            'Success': ['count', 'mean', 'std']
        }).round(4)

        # Transaction statistics table
        tx_stats = self.tx_df.groupby('NoiseLevel').agg({
            'TransactionTime': ['mean', 'std', 'min', 'max'],
            'ProofTime': ['mean', 'std', 'min', 'max'],
            'EncryptionTime': ['mean', 'std', 'min', 'max'],
            'GasUsed': ['mean', 'std']
        }).round(2)

        # Generate LaTeX tables
        with open(self.output_dir / 'tables.tex', 'w') as f:
            f.write(self._format_performance_table(perf_stats))
            f.write('\n\n')
            f.write(self._format_reliability_table(rel_stats))
            f.write('\n\n')
            f.write(self._format_transactions_table(tx_stats))

    def _format_performance_table(self, stats):
        """Format performance statistics as LaTeX table"""
        latex = """
\\begin{table}[ht]
\\centering
\\caption{Authentication Performance Metrics at Different Noise Levels}
\\label{tab:performance}
\\begin{tabular}{lcccccc}
\\hline
Noise & \\multicolumn{2}{c}{Proof Generation (ms)} & \\multicolumn{2}{c}{Verification (ms)} & \\multicolumn{2}{c}{Gas Used} \\\\
Level & Mean $\\pm$ Std & Range & Mean $\\pm$ Std & Range & Mean & Std \\\\
\\hline
"""
        for noise in stats.index:
            row = stats.loc[noise]
            latex += f"{noise} & {row['ProofGenTime']['mean']:.2f} $\\pm$ {row['ProofGenTime']['std']:.2f} & "
            latex += f"[{row['ProofGenTime']['min']:.2f}, {row['ProofGenTime']['max']:.2f}] & "
            latex += f"{row['VerifyTime']['mean']:.2f} $\\pm$ {row['VerifyTime']['std']:.2f} & "
            latex += f"[{row['VerifyTime']['min']:.2f}, {row['VerifyTime']['max']:.2f}] & "
            latex += f"{row['GasUsed']['mean']:.0f} & {row['GasUsed']['std']:.0f} \\\\\n"
        
        latex += """\\hline
\\end{tabular}
\\end{table}"""
        return latex

    def _format_reliability_table(self, stats):
        """Format reliability statistics as LaTeX table"""
        latex = """
\\begin{table}[ht]
\\centering
\\caption{Authentication Reliability Metrics at Different Noise Levels}
\\label{tab:reliability}
\\begin{tabular}{lccc}
\\hline
Noise & Number of & Success & Standard \\\\
Level & Tests & Rate & Deviation \\\\
\\hline
"""
        for noise in stats.index:
            row = stats.loc[noise]
            latex += f"{noise} & {int(row['Success']['count'])} & "
            latex += f"{row['Success']['mean']*100:.2f}\\% & "
            latex += f"{row['Success']['std']*100:.2f}\\% \\\\\n"
        
        latex += """\\hline
\\end{tabular}
\\end{table}"""
        return latex

    def _format_transactions_table(self, stats):
        """Format transaction statistics as LaTeX table"""
        latex = """
\\begin{table}[ht]
\\centering
\\caption{Transaction Performance Metrics at Different Noise Levels}
\\label{tab:transactions}
\\begin{tabular}{lcccccc}
\\hline
Noise & \\multicolumn{2}{c}{Transaction Time (ms)} & \\multicolumn{2}{c}{Encryption Time (ms)} & \\multicolumn{2}{c}{Gas Used} \\\\
Level & Mean $\\pm$ Std & Range & Mean $\\pm$ Std & Range & Mean & Std \\\\
\\hline
"""
        for noise in stats.index:
            row = stats.loc[noise]
            latex += f"{noise} & {row['TransactionTime']['mean']:.2f} $\\pm$ {row['TransactionTime']['std']:.2f} & "
            latex += f"[{row['TransactionTime']['min']:.2f}, {row['TransactionTime']['max']:.2f}] & "
            latex += f"{row['EncryptionTime']['mean']:.2f} $\\pm$ {row['EncryptionTime']['std']:.2f} & "
            latex += f"[{row['EncryptionTime']['min']:.2f}, {row['EncryptionTime']['max']:.2f}] & "
            latex += f"{row['GasUsed']['mean']:.0f} & {row['GasUsed']['std']:.0f} \\\\\n"
        
        latex += """\\hline
\\end{tabular}
\\end{table}"""
        return latex

    def run_all_visualizations(self):
        """Generate all plots and tables"""
        print("Generating performance plots...")
        self.plot_performance_vs_noise()
        
        print("Generating transaction time plot...")
        self.plot_transaction_times()
        
        print("Generating encryption time plot...")
        self.plot_encryption_times()
        
        print("Generating authentication success rate plot...")
        self.plot_success_rate()
        
        print("Generating gas usage plots...")
        self.plot_gas_usage()
        self.plot_transaction_gas_usage()
        
        print("Generating memory usage plot...")
        self.plot_memory_usage()
        
        print("Generating LaTeX tables...")
        self.generate_latex_tables()
        
        print(f"All visualizations saved to {self.output_dir}")

if __name__ == "__main__":
    visualizer = ExperimentVisualizer()
    visualizer.run_all_visualizations()
