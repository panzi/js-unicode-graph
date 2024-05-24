export type Aggregate = 'average'|'sum'|'min'|'max';
export type Style = 'filled'|'line';

export interface PlotOptions {
    yLabel?: boolean|((y: number) => string);
    xLabel?: boolean|((x: number) => string);
    width?:  number;
    height?: number;
    xRange?: [min: number, max: number];
    yRange?: [min: number, max: number];

    /** default: 'average' */
    aggregate?: Aggregate;

    /** default: 'filled' */
    style?: Style;
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
        const style = options?.style ?? 'filled';
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
            for (let index = 0; index < values.length; ++ index) {
                if (values[index] === Infinity) {
                    values[index] = 0;
                }
            }
        } else if (aggregate === 'min') {
            for (let index = 0; index < values.length; ++ index) {
                values[index] = Infinity;
            }
            for (const [x, y] of data) {
                const unicodeIndex = (unicodeWidth * (x - xMin) / xSpan)|0;
                const oldY = values[unicodeIndex];
                if (y < oldY) {
                    values[unicodeIndex] = y;

                    if (y < yMinValue) {
                        yMinValue = y;
                    }
                    if (y > yMaxValue) {
                        yMaxValue = y;
                    }
                }
            }
        } else if (aggregate === 'max') {
            for (let index = 0; index < values.length; ++ index) {
                values[index] = -Infinity;
            }
            for (const [x, y] of data) {
                const unicodeIndex = (unicodeWidth * (x - xMin) / xSpan)|0;
                const oldY = values[unicodeIndex];
                if (y > oldY) {
                    values[unicodeIndex] = y;

                    if (y < yMinValue) {
                        yMinValue = y;
                    }
                    if (y > yMaxValue) {
                        yMaxValue = y;
                    }
                }
            }
            for (let index = 0; index < values.length; ++ index) {
                if (values[index] === -Infinity) {
                    values[index] = 0;
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
                yMin -= (yMax - yMin) * 0.025;
            }
        }

        const yZero = yMin < 0 ? -yMin : 0;
        const ySpan = yMin < 0 ? Math.max(0, yMax) - yMin : yMax;
        const intYZero = (unicodeHeight * yZero / ySpan)|0;
        const intValues = new Int32Array(unicodeWidth);

        for (let index = 0; index < values.length; ++ index) {
            const value = unicodeHeight * values[index] / ySpan;
            intValues[index] = value < 0 ? Math.floor(value) : Math.ceil(value);
        }

        const canvas: Uint8Array[] = [];
        for (let y = 0; y < height; ++ y) {
            canvas.push(new Uint8Array(width));
        }

        if (style === 'filled') {
            for (let x = 0; x < intValues.length; ++ x) {
                const value = intValues[x];
                const xIndex = (x >> 1);
                if (xIndex < 0) {
                    continue;
                }

                if (xIndex >= width) {
                    break;
                }

                const xShift = 2 - (x & 1) * 2;
                if (value === 0) {
                    // pass
                } else if (value > 0) {
                    for (let y = 0; y < value; ++ y) {
                        const drawY = intYZero + y;
                        const yIndex = drawY >> 1;
                        if (yIndex >= canvas.length) {
                            break;
                        }
                        if (yIndex >= 0) {
                            const mask = (0b1 << (drawY & 1)) << xShift;
                            canvas[yIndex][xIndex] |= mask;
                        }
                    }
                } else {
                    for (let y = -1; y >= value; -- y) {
                        const drawY = intYZero + y;
                        let yIndex = drawY >> 1;
                        if (yIndex < 0) {
                            break;
                        }
                        if (yIndex < canvas.length) {
                            const mask = (0b1 << (drawY & 1)) << xShift;
                            canvas[yIndex][xIndex] |= mask;
                        }
                    }
                }
            }
        } else {
            let prevValue = intValues[0];
            for (let x = 0; x < intValues.length; ++ x) {
                let value = intValues[x];
                const xIndex = (x >> 1);
                if (xIndex < 0) {
                    prevValue = value;
                    continue;
                }

                if (xIndex >= width) {
                    break;
                }

                const xShift = 2 - (x & 1) * 2;

                // not sure if this is just treating a symptom
                if (value > 0) -- value;

                if (value === prevValue) {
                    const drawY = intYZero + value;
                    const yIndex = drawY >> 1;
                    if (yIndex < canvas.length && yIndex >= 0) {
                        const mask = (0b1 << (drawY & 1)) << xShift;
                        canvas[yIndex][xIndex] |= mask;
                    }
                } else if (value > prevValue) {
                    for (let y = prevValue + 1; y <= value; ++ y) {
                        const drawY = intYZero + y;
                        const yIndex = drawY >> 1;
                        if (yIndex >= canvas.length) {
                            break;
                        }
                        if (yIndex >= 0) {
                            const mask = (0b1 << (drawY & 1)) << xShift;
                            canvas[yIndex][xIndex] |= mask;
                        }
                    }
                } else {
                    for (let y = prevValue - 1; y >= value; -- y) {
                        const drawY = intYZero + y;
                        let yIndex = drawY >> 1;
                        if (yIndex < 0) {
                            break;
                        }
                        if (yIndex < canvas.length) {
                            const mask = (0b1 << (drawY & 1)) << xShift;
                            canvas[yIndex][xIndex] |= mask;
                        }
                    }
                }

                prevValue = value;
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
