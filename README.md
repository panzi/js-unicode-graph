Unicode Plot
============

A very simple function to plot data as Unicode for console output.

Example
-------

```TypeScript
const TAU = 2 * Math.PI;
const values = new Array(320);
for (let index = 0; index < values.length; ++ index) {
    const x = TAU * (index / values.length);
    values[index] = [x, Math.sin(x % TAU)];
}
const lines = unicodePlot(values, {
    yRange: [-1.5, 1.5],
    xLabel: x => x.toFixed(3),
    yLabel: y => y.toFixed(3),
});
console.log(lines.join('\n'));
```

![Screenshot of the output](screenshot.png)
