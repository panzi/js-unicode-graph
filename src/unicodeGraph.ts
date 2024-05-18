export interface BrailleGraphOptions<X> {
    yLabel?: (y: number) => string;
    xLabel?: (x: X) => string;
    xIndex?: (x: X, index: number, width: number) => number;
    width?:  number;
    height?: number;
    xRange?: [min: number, max: number];
    yRange?: [min: number, max: number];
}

function defaultXLabel<X>(x: X): string {
    return String(x);
}

function defaultYLabel(y: number): string {
    return String(y);
}

function defaultXIndex<X>(x: X, index: number, width: number): number {
    return index;
}

export default function unicodeGraph<X>(
    data: ReadonlyArray<readonly [x: X, y: number]>,
    options?: BrailleGraphOptions<X>,
): string[] {
    const lines: string[] = [];

    const width  = options?.width  ?? 80;
    const height = options?.height ?? 40;
    const unicodeWidth  = width  * 2;
    const unicodeHeight = height * 2;
    const xIndex = options?.xIndex ?? defaultXIndex;
    const xLabel = options?.xLabel ?? defaultXLabel;
    const yLabel = options?.yLabel ?? defaultYLabel;

    if (data.length === 0) {
        const line = ' '.repeat(width);
        for (let y = 0; y < height; ++ y) {
            lines.push(line);
        }
    } else {
        const sparseValues: [xIndex: number, x: X, y: number][] =
            data.map(([x, y], index) => [xIndex(x, index, width), x, y]);

        // sparseValues.sort((lhs, rhs) => {
        //     return lhs[0] - rhs[0];
        // });

        const xMinIndex = sparseValues[0][0];
        const xMaxIndex = sparseValues[sparseValues.length - 1][0];
        const xIndexLength = xMaxIndex + 1 - xMinIndex;

        const values = new Float64Array(unicodeWidth);
        const counts = new Uint32Array(unicodeWidth);

        for (const [xIndex, x, y] of sparseValues) {
            const unicodeIndex = (unicodeWidth * (xIndex - xMinIndex) / xIndexLength)|0;
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

        console.log({ yMin, yMax, ySpan, yWatermark, intYWatermark, x0: data[0][0], y0: data[0][1], int0: intValues[0] });
        // console.log(intValues);
        outer: for (let x = 0; x < intValues.length; ++ x) {
            const value = intValues[x];
            const full = (x & 1) ? 0b0011 : 0b1100;
            const xIndex = x >> 1;
            if (xIndex < 0) {
                continue;
            }
            if (xIndex >= width) {
                break;
            }
            if (value >= 0) {
                if (x === 0) {
                    console.log("value >= 0");
                }
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
                if (x === 0) {
                    console.log("value < 0");
                }
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

async function main() {
    const values: [number, number][] = new Array(80 * 4);
    const TAU = 2 * Math.PI;

    process.stdout.write('\x1B[?25l');

    let timer: NodeJS.Timeout|null = null;
    let running = true;
    const shutdown = () => {
        running = false;
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', () => {
        process.stdout.write('\x1B[?25h');
    });
    while (running) {
        const now = Date.now();
        for (let index = 0; index < values.length; ++ index) {
            const x = ((now / 10_000 * TAU) + (TAU * (index / values.length))) % TAU;
            values[index] = [x, Math.sin(x)];
        }
        process.stdout.write('\x1B[1;1H\x1B[2J');
        const lines = unicodeGraph(values, { xRange: [ values[0][0] - 2, values[values.length - 1][0] + 2 ], yRange: [-1, 1] });
        console.log('-'.repeat(80));
        console.log(lines.join('\n'));
        console.log('-'.repeat(80));

        if (!running) {
            break;
        }

        await new Promise<void>(resolve => {
            timer = setTimeout(() => {
                timer = null;
                resolve();
            }, 1000/30);
        });
    }
}

main();
