const analyticsDashboardService = require('../../../src/services/analyticsDashboardService');

describe('AnalyticsDashboardService', () => {
    describe('_calculateTrend', () => {
        // Test edge case identified by CodeRabbit: values between 0 and 1
        it('should calculate trend correctly when previous is between 0 and 1', () => {
            // Previous: 0.5, Latest: 1.0
            // Expected: ((1.0 - 0.5) / 0.5) * 100 = 100%
            const series = [0.5, 1.0];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(100);
        });

        it('should return 0 for series with less than 2 values', () => {
            expect(analyticsDashboardService._calculateTrend([])).toBe(0);
            expect(analyticsDashboardService._calculateTrend([1])).toBe(0);
        });

        it('should return 100 when previous is 0 and latest > 0', () => {
            const series = [0, 1];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(100);
        });

        it('should return 0 when previous is 0 and latest is 0', () => {
            const series = [0, 0];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(0);
        });

        it('should calculate negative trend correctly', () => {
            // Previous: 100, Latest: 50
            // Expected: ((50 - 100) / 100) * 100 = -50%
            const series = [100, 50];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(-50);
        });

        it('should calculate positive trend correctly', () => {
            // Previous: 50, Latest: 100
            // Expected: ((100 - 50) / 50) * 100 = 100%
            const series = [50, 100];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(100);
        });

        it('should handle decimal values correctly', () => {
            // Previous: 0.25, Latest: 0.75
            // Expected: ((0.75 - 0.25) / 0.25) * 100 = 200%
            const series = [0.25, 0.75];
            const trend = analyticsDashboardService._calculateTrend(series);
            expect(trend).toBe(200);
        });
    });
});

