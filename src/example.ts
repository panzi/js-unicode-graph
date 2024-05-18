import unicodeGraph, { printBox } from "./index.js";

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
            const x = ((now / 10_000 * TAU) + (TAU * (index / values.length)));
            values[index] = [x, Math.sin(x % TAU)];
        }
        process.stdout.write('\x1B[1;1H\x1B[2J');
        const lines = unicodeGraph(values, { yRange: [-1, 1] });
        // const lines = unicodeGraph(values, { xRange: [ values[0][0] + Math.PI*0.5, values[values.length - 1][0] - Math.PI*0.5 ], yRange: [-.5, .5] });
        printBox(lines);

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
