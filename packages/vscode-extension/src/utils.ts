/**
 * Utility functions for AgentWatch
 */

/**
 * Formats a risk level into a display string with emoji
 */
export function formatRiskLevel(level: 'high' | 'medium' | 'low'): string {
  const icons: Record<string, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };
  return `${icons[level]} ${level.charAt(0).toUpperCase() + level.slice(1)} Risk`;
}

/**
 * Determines if a file should be reviewed based on its path
 */
export function shouldReviewFile(filePath: string): boolean {
  const ignoredPatterns = [
    /node_modules/,
    /\.git\//,
    /dist\//,
    /build\//,
    /coverage\//,
    /\.lock$/,
    /package-lock\.json$/,
  ];
  return !ignoredPatterns.some((pattern) => pattern.test(filePath));
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + '…';
}
