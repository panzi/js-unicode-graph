export interface PlotOptions {
    yLabel?: boolean|((y: number) => string);
    xLabel?: boolean|((x: number) => string);
    width?:  number;
    height?: number;
    xRange?: [min: number, max: number];
    yRange?: [min: number, max: number];

    /** default: 'average' */
    aggregate?: 'average'|'sum';
}

export default function unicodePlot(
    data: ReadonlyArray<readonly [x: number, y: number]>,
    options?: PlotOptions,
): string[] {
    const lines: string[] = [];

    const width  = options?.width  ?? 80;
    const height = options?.height ?? 40;
    const unicodeWidth  = width  * 2;
    const unicodeHeight = height * 2;
    const xLabel = options?.xLabel === true ? String : options?.xLabel || null;
    const yLabel = options?.yLabel === true ? String : options?.yLabel || null;

    if (data.length === 0 || width <= 0) {
        const line = ' '.repeat(width);
        for (let y = 0; y < height; ++ y) {
            lines.push(line);
        }
    } else if (height > 0) {
        const aggregate = options?.aggregate ?? 'average';
        const xRange = options?.xRange;

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
        const xSpan = xMax - xMin;

        const yRange = options?.yRange;
        let yMin: number;
        let yMax: number;
        let yMinValue = +Infinity;
        let yMaxValue = -Infinity;

        if (aggregate === 'sum') {
            for (const [x, y] of data) {
                const unicodeIndex = (unicodeWidth * (x - xMin) / xSpan)|0;
                values[unicodeIndex] += y;
            }

            for (let index = 0; index < values.length; ++ index) {
                const y = values[index];
                if (y < yMinValue) {
                    yMinValue = y;
                }
                if (y > yMaxValue) {
                    yMaxValue = y;
                }
            }
        } else {
            const counts = new Uint32Array(unicodeWidth);
            for (const [x, y] of data) {
                const unicodeIndex = (unicodeWidth * (x - xMin) / xSpan)|0;
                values[unicodeIndex] += y;
                ++ counts[unicodeIndex];
            }

            for (let index = 0; index < values.length; ++ index) {
                const y = (values[index] /= counts[index]);
                if (y < yMinValue) {
                    yMinValue = y;
                }
                if (y > yMaxValue) {
                    yMaxValue = y;
                }
            }
        }

        if (yRange) {
            [yMin, yMax] = yRange;
        } else {
            yMin = yMinValue;
            yMax = yMaxValue;

            if (yMin < 0) {
                // HACK: cut off compensation
                // TODO: find out why I need it
                yMin -= (yMax - yMin) * 0.00005;
            }
        }

        const yZero = yMin < 0 ? -yMin : 0;
        const ySpan = yMin < 0 ? Math.max(0, yMax) - yMin : yMax;
        const intYZero = (unicodeHeight * yZero / ySpan)|0;
        const intValues = new Int32Array(unicodeWidth);

        for (let index = 0; index < values.length; ++ index) {
            intValues[index] = (unicodeHeight * values[index] / ySpan)|0;
        }

        const canvas: Uint8Array[] = [];
        for (let y = 0; y < height; ++ y) {
            canvas.push(new Uint8Array(width));
        }

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

            if (value === 0) {
                // const mask = (x & 1) ? 0b0001 : 0b0100;
                // const yIndex = intYZero >> 1;
                // if (yIndex >= height) continue outer;
                // canvas[yIndex][xIndex] |= mask;
            } else if (value > 0) {
                let y = 0;
                for (; y + 2 <= value; y += 2) {
                    const yIndex = (intYZero + y) >> 1;
                    if (yIndex >= height) {
                        if (yIndex > 0) {
                            canvas[yIndex - 1][xIndex] = 0b11111;
                        }
                        continue outer;
                    }
                    canvas[yIndex][xIndex] |= full;
                }
                const bits = value % 2;
                let mask = 0b11 >> (2 - bits);
                if (mask) {
                    if ((x & 1) === 0) {
                        mask = mask << 2;
                    }
                    const yIndex = (intYZero + y) >> 1;
                    if (yIndex >= height) {
                        if (yIndex > 0) {
                            canvas[yIndex - 1][xIndex] = 0b11111;
                        }
                        continue outer;
                    }
                    canvas[yIndex][xIndex] |= mask;
                }
            } else {
                let y = 0;
                for (; y - 2 >= value; y -= 2) {
                    const yIndex = (intYZero + y - 2) >> 1;
                    if (yIndex >= 0 && yIndex < height) {
                        canvas[yIndex][xIndex] |= full;
                    } else if (yIndex >= -1 && yIndex + 1 < canvas.length) {
                        canvas[yIndex + 1][xIndex] = 0b11111;
                    }
                }
                const bits = -value % 2;
                let mask = (0b11 << (2 - bits)) & 0b11;
                if (mask) {
                    if ((x & 1) === 0) {
                        mask = mask << 2;
                    }
                    const yIndex = (intYZero + y - 2) >> 1;
                    if (yIndex < 0 || yIndex >= height) {
                        if (yIndex >= -1 && yIndex + 1 < canvas.length) {
                            canvas[yIndex + 1][xIndex] = 0b11111;
                        }
                        continue outer;
                    }
                    canvas[yIndex][xIndex] |= mask;
                }
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

        if (yLabel) {
            const indices = new Set<number>();
            const addYLabel = (y: number) => {
                let index = lines.length - ((intYZero + (unicodeHeight * y / ySpan)|0) >> 1) - 1;
                if (index < 0) {
                    index = 0;
                } else if (index >= lines.length) {
                    index = lines.length - 1;
                }

                if (!indices.has(index)) {
                    lines[index] = `${lines[index]} ${yLabel(y)}`;
                    indices.add(index);
                }
            };

            if (yMin <= 0 && 0 <= yMax) {
                addYLabel(0);
            }

            addYLabel(Math.min(yMaxValue, yMax));
            addYLabel(Math.max(yMinValue, yMin));
        }

        if (xLabel) {
            const extraLines: { len: number, line: string[] }[] = [];

            const addXLabel = (x: number) => {
                const index = (width * (x - xMin) / xSpan)|0;
                const label = xLabel(x);
                for (const item of extraLines) {
                    if (item.len < index && item.len + 1 + label.length <= width) {
                        const padding = ' '.repeat(
                            index + label.length <= width ?
                                index - item.len :
                                width - item.len - label.length
                            );
                        item.line.push(padding);
                        item.line.push(label);
                        item.len = index + item.len;
                        return;
                    }
                }

                const line: string[] = [];
                let len: number;

                if (index + label.length >= width) {
                    len = label.length;
                    if (label.length < width) {
                        const padding = ' '.repeat(width - label.length);
                        line.push(padding);
                        len += padding.length;
                    }
                    line.push(label);
                } else {
                    const padding = ' '.repeat(index);
                    line.push(padding, label);
                    len = index + label.length;
                }
                extraLines.push({ len, line });
            };

            const start = Math.max(xMinValue, xMin);
            const end   = Math.min(xMaxValue, xMax);

            if (start < 0 && 0 < end) {
                addXLabel(0);
            }

            addXLabel(start);
            addXLabel(end);

            for (const line of extraLines) {
                lines.push(line.line.join(''));
            }
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

MASK_MAP[0b11111] = '▓';
