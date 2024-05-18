export interface BrailleGraphOptions {
    yLabel?: (y: number) => string;
    xLabel?: (x: number) => string;
    width?:  number;
    height?: number;
    xRange?: [min: number, max: number];
    yRange?: [min: number, max: number];
}

function defaultXLabel(x: number): string {
    return String(x);
}

function defaultYLabel(y: number): string {
    return String(y);
}

export default function unicodeGraph(
    data: ReadonlyArray<readonly [x: number, y: number]>,
    options?: BrailleGraphOptions,
): string[] {
    const lines: string[] = [];

    const width  = options?.width  ?? 80;
    const height = options?.height ?? 40;
    const unicodeWidth  = width  * 2;
    const unicodeHeight = height * 2;
    const xLabel = options?.xLabel ?? defaultXLabel;
    const yLabel = options?.yLabel ?? defaultYLabel;

    if (data.length === 0) {
        const line = ' '.repeat(width);
        for (let y = 0; y < height; ++ y) {
            lines.push(line);
        }
    } else {
        const xRange = options?.xRange; // TODO

        let xMin: number;
        let xMax: number;

        let xMinValue = +Infinity;
        let xMaxValue = -Infinity;

        for (const [x] of data) {
            if (x < xMinValue) {
                xMinValue = x;
            }
            if (x > xMaxValue) {
                xMaxValue = x;
            }
        }

        if (xRange) {
            [xMin, xMax] = xRange;
        } else {
            xMin = xMinValue;
            xMax = xMaxValue;
        }

        const values = new Float64Array(unicodeWidth);
        const counts = new Uint32Array(unicodeWidth);
        const xSpan = xMax - xMin;

        for (const [x, y] of data) {
            const unicodeIndex = (unicodeWidth * (x - xMin) / xSpan)|0;
            values[unicodeIndex] += y;
            ++ counts[unicodeIndex];
        }

        const yRange = options?.yRange;
        let yMin: number;
        let yMax: number;

        if (yRange) {
            [yMin, yMax] = yRange;

            for (let index = 0; index < values.length; ++ index) {
                values[index] /= counts[index];
            }
        } else {
            yMin = +Infinity;
            yMax = -Infinity;

            for (let index = 0; index < values.length; ++ index) {
                const y = (values[index] /= counts[index]);
                if (y < yMin) {
                    yMin = y;
                }
                if (y > yMax) {
                    yMax = y;
                }
            }
        }

        const yWatermark = yMin < 0 ? -yMin : 0;
        const ySpan = yMin < 0 ? Math.max(0, yMax) - yMin : yMax;
        const intYWatermark = (unicodeHeight * yWatermark / ySpan)|0;
        const intValues = new Int32Array(unicodeWidth);

        for (let index = 0; index < values.length; ++ index) {
            intValues[index] = (unicodeHeight * values[index] / ySpan)|0;
        }

        const canvas: Uint8Array[] = [];
        for (let y = 0; y < height; ++ y) {
            canvas.push(new Uint8Array(width));
        }

        // console.log({ yMin, yMax, ySpan, yWatermark, intYWatermark, x0: data[0][0], y0: data[0][1], int0: intValues[0], xMin, xMax, xMinValue, xMaxValue, xSpan });

        outer: for (let x = 0; x < intValues.length; ++ x) {
            const value = intValues[x];
            const full = (x & 1) ? 0b0011 : 0b1100;
            const xIndex = (x >> 1);
            if (xIndex < 0) {
                continue;
            }
            if (xIndex >= width) {
                break;
            }
            if (value >= 0) {
                let y = 0;
                for (; y + 2 <= value; y += 2) {
                    const yIndex = (intYWatermark + y) >> 1;
                    if (yIndex >= height) continue outer;
                    canvas[yIndex][xIndex] |= full;
                }
                const bits = value % 2;
                let mask = 0b11 >> (2 - bits);
                if ((x & 1) === 0) {
                    mask = mask << 2;
                }
                const yIndex = (intYWatermark + y) >> 1;
                if (yIndex >= height) continue outer;
                canvas[yIndex][xIndex] |= mask;
            } else {
                let y = 0;
                for (; y - 2 >= value; y -= 2) {
                    const yIndex = (intYWatermark + y - 2) >> 1;
                    if (yIndex >= 0 && yIndex < height) {
                        canvas[yIndex][xIndex] |= full;
                    }
                }
                const bits = -value % 2;
                let mask = (0b11 << (2 - bits)) & 0b11;
                if ((x & 1) === 0) {
                    mask = mask << 2;
                }
                const yIndex = (intYWatermark + y - 2) >> 1;
                if (yIndex < 0 || yIndex >= height) continue outer;
                canvas[yIndex][xIndex] |= mask;
            }
        }

        const map = MASK_MAP;
        for (let y = height - 1; y >= 0; -- y) {
            const line: string[] = [];
            for (let x = 0; x < width; ++ x) {
                const mask = canvas[y][x];
                line.push(map[mask]);
            }
            lines.push(line.join(''));
        }
    }

    return lines;
}

const MASK_MAP = [
    ' ', // 0000
    '▗', // 0001
    '▝', // 0010
    '▐', // 0011
    '▖', // 0100
    '▄', // 0101
    '▞', // 0110
    '▟', // 0111
    '▘', // 1000
    '▚', // 1001
    '▀', // 1010
    '▜', // 1011
    '▌', // 1100
    '▙', // 1101
    '▛', // 1110
    '█', // 1111
];

export function makeBox(text: string|string[]): string[] {
    const lines = Array.isArray(text) ? text : text.split('\n');
    let maxLen = 0;
    for (const line of lines) {
        const len = line.length;
        if (len > maxLen) {
            maxLen = len;
        }
    }

    const outline = '─'.repeat(maxLen);
    const out: string[] = [];
    out.push(`┌${outline}┐`);
    for (const line of lines) {
        out.push(`│${line.padEnd(maxLen)}│`);
    }
    out.push(`└${outline}┘`);

    return out;
}

export function printBox(text: string|string[]): void {
    console.log(makeBox(text).join('\n'));
}
