export type EntropyMode = 'byte' | 'bit';

export interface EntropyResult {
	mode: EntropyMode;
	entropy: number;
	optimumCompression: number; // Estimated compression % (0-100)
	chiSquare: number;
	chiSquarePercent: number; // Probability percentage (0-100)
	mean: number;
	monteCarloPi: number;
	monteCarloPiError: number;
	serialCorrelation: number;
	unitCount: number; // Total samples (bytes or bits)
}

export async function analyzeEntropy(
	bytes: Uint8Array,
	mode: EntropyMode = 'byte'
): Promise<EntropyResult> {
	return new Promise((resolve) => {
		const N = bytes.length;

		// Handle empty array
		if (N === 0) {
			resolve({
				mode,
				entropy: 0,
				optimumCompression: 0,
				chiSquare: 0,
				chiSquarePercent: 0,
				mean: 0,
				monteCarloPi: 0,
				monteCarloPiError: 0,
				serialCorrelation: 0,
				unitCount: 0
			});
			return;
		}

		// --- Common: Error Function (erf) approximation ---
		const erf = (x: number): number => {
			const sign = x < 0 ? -1 : 1;
			x = Math.abs(x);
			const t = 1.0 / (1.0 + 0.3275911 * x);
			const y =
				1.0 -
				((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
					0.254829592) *
					t *
					Math.exp(-x * x);
			return sign * y;
		};

		// --- Common: Monte Carlo Pi (48-bit coordinates) ---
		let hits = 0;
		const points = Math.floor(N / 6);
		const MAX_24BIT = 16777215.0; // 2^24 - 1

		for (let i = 0; i < points; i++) {
			const idx = i * 6;
			// Combine to 24-bit coords
			const xVal = (bytes[idx] << 16) | (bytes[idx + 1] << 8) | bytes[idx + 2];
			const yVal = (bytes[idx + 3] << 16) | (bytes[idx + 4] << 8) | bytes[idx + 5];

			// Normalize to [0, 1)
			const x = xVal / MAX_24BIT;
			const y = yVal / MAX_24BIT;

			// Check if inside unit circle
			if (x * x + y * y <= 1.0) hits++;
		}

		const monteCarloPi = points === 0 ? 0 : (4.0 * hits) / points;
		const monteCarloPiError = points === 0 ? 0 : Math.abs((monteCarloPi - Math.PI) / Math.PI) * 100;

		// ==========================================
		//  Byte Mode (8-bit)
		// ==========================================
		if (mode === 'byte') {
			const counts = new Uint32Array(256);
			let sum = 0;

			// Count occurrences
			for (let i = 0; i < N; i++) {
				counts[bytes[i]]++;
				sum += bytes[i];
			}

			const mean = sum / N;
			let entropy = 0;
			let chiSquare = 0;
			const expected = N / 256.0;

			// Calc Entropy & Chi-Square
			for (let v = 0; v < 256; v++) {
				const p = counts[v] / N;
				if (p > 0) entropy -= p * Math.log2(p);
				const diff = counts[v] - expected;
				chiSquare += (diff * diff) / expected;
			}

			const optimumCompression = Math.max(0, Math.round(((8.0 - entropy) / 8.0) * 100));

			// Chi-Square Prob (Wilson-Hilferty)
			let chiSquarePercent = 0;
			if (expected > 0) {
				const df = 255;
				const a = 2.0 / (9.0 * df);
				const z = (Math.pow(chiSquare / df, 1.0 / 3.0) - (1.0 - a)) / Math.sqrt(a);
				const pValue = 0.5 * (1.0 - erf(z / Math.SQRT2));
				chiSquarePercent = Math.max(0, Math.min(100, pValue * 100));
			}

			// Serial Correlation
			let scNum = 0;
			let scDen = 0;
			for (let i = 0; i < N; i++) {
				const currentDev = bytes[i] - mean;
				const nextDev = bytes[(i + 1) % N] - mean; // Circular bound
				scNum += currentDev * nextDev;
				scDen += currentDev * currentDev;
			}
			const serialCorrelation = scDen === 0 ? 0 : scNum / scDen;

			resolve({
				mode: 'byte',
				entropy,
				optimumCompression,
				chiSquare,
				chiSquarePercent,
				mean,
				monteCarloPi,
				monteCarloPiError,
				serialCorrelation,
				unitCount: N
			});
		}
		// ==========================================
		//  Bit Mode (1-bit)
		// ==========================================
		else {
			const totalBits = N * 8;
			let count1 = 0;

			// Pass 1: Count 1s (MSB to LSB)
			for (let i = 0; i < N; i++) {
				const b = bytes[i];
				for (let j = 7; j >= 0; j--) {
					count1 += (b >> j) & 1;
				}
			}

			const count0 = totalBits - count1;
			const mean = count1 / totalBits;

			// Calc Entropy
			let entropy = 0;
			const p0 = count0 / totalBits;
			const p1 = count1 / totalBits;
			if (p0 > 0) entropy -= p0 * Math.log2(p0);
			if (p1 > 0) entropy -= p1 * Math.log2(p1);

			// Max entropy for bit mode is 1.0
			const optimumCompression = Math.max(0, Math.round(((1.0 - entropy) / 1.0) * 100));

			// Calc Chi-Square
			const expected = totalBits / 2.0;
			const chiSquare =
				Math.pow(count0 - expected, 2) / expected + Math.pow(count1 - expected, 2) / expected;

			// Exact Chi-Square Prob for df=1
			let chiSquarePercent = 0;
			if (expected > 0) {
				const pValue = 1.0 - erf(Math.sqrt(chiSquare / 2.0));
				chiSquarePercent = Math.max(0, Math.min(100, pValue * 100));
			}

			let scNum = 0;
			let scDen = 0;
			const firstBit = (bytes[0] >> 7) & 1;

			for (let i = 0; i < N; i++) {
				const b = bytes[i];
				for (let j = 7; j >= 0; j--) {
					const currentBit = (b >> j) & 1;

					let nextBit: number;

					if (j === 0) {
						nextBit = i === N - 1 ? firstBit : (bytes[i + 1] >> 7) & 1;
					} else {
						nextBit = (b >> (j - 1)) & 1;
					}

					const currentDev = currentBit - mean;
					const nextDev = nextBit - mean;
					scNum += currentDev * nextDev;
					scDen += currentDev * currentDev;
				}
			}
			const serialCorrelation = scDen === 0 ? 0 : scNum / scDen;

			resolve({
				mode: 'bit',
				entropy,
				optimumCompression,
				chiSquare,
				chiSquarePercent,
				mean,
				monteCarloPi,
				monteCarloPiError,
				serialCorrelation,
				unitCount: totalBits
			});
		}
	});
}
