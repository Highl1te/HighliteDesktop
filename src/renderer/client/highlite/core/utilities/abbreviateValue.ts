export function abbreviateValue(number: number): string {
    // Values less than 1000 are returned as is
    if (number < 1000) {
        return number.toString();
    }

    // Values between 1000 and 999,999 are abbreviated with 'K'
    if (number < 1000000) {
        return (number / 1000).toFixed(1) + 'K';
    }

    // Values between 1,000,000 and 999,999,999 are abbreviated with 'M'
    if (number < 1000000000) {
        return (number / 1000000).toFixed(1) + 'M';
    }

    // Values between 1,000,000,000 and 999,999,999,999 are abbreviated with 'B'
    if (number < 1000000000000) {
        return (number / 1000000000).toFixed(1) + 'B';
    }

    // Values 1 trillion and above are abbreviated with 'T'
    return (number / 1000000000000).toFixed(1) + 'T';
}
