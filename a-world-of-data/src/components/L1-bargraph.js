import * as d3 from "d3";

const width = 800;
const height = 500;
const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const svg = d3.select("#L1-div-bargraph-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "22px")
    .style("font-weight", "bold")
    .style("fill", "#FFFFFF")
    .text("Cereal Yield Worldwide by Year");

const xAxisGroup = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`);
const yAxisGroup = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`);

svg.append("text")
    .attr("x", width / 2)
    .attr("y", height)
    .attr("text-anchor", "middle")
    .style("fill", "#c4c4c4")
    .style("font-weight", "600")
    .text("Year");
svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("fill", "#c4c4c4")
    .style("font-weight", "600")
    .text("Cereal Yield (tonnes per hectare, worldwide average)");

// CSVs
Promise.all([
    d3.csv("/data/cereal-yield.csv", d3.autoType)
]).then(([yieldData]) => {
    const getYear = d => d["Year"];
    const aggregated = d3.rollup(yieldData, v => {
        const total = d3.mean(v, d => d["Cereals - Yield (tonnes per hectare)"]);
        return Number(total.toFixed(2));
    }, getYear);

    const finalized = Array.from(aggregated, ([year, total_yield]) => ({
        year: year,
        yield: total_yield
    }));

    const xScale = d3.scaleBand().domain(finalized.map(d => d.year)).range([margin.left, width - margin.right]).padding(0.2);
    const yScale = d3.scaleLinear().domain([0, d3.max(finalized, d => d.yield)]).nice().range([height - margin.bottom, margin.top]);
    xAxisGroup.call(d3.axisBottom(xScale));
    yAxisGroup.call(d3.axisLeft(yScale));

    xAxisGroup.selectAll("text")
        .attr("y", 0)
        .attr("x", -9)
        .attr("dy", ".35em")
        .attr("transform", "rotate(-90)")
        .style("text-anchor", "end");

svg.selectAll(".bar")
    .data(finalized)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("fill", "#699F64")
    .attr("x", d => xScale(d.year))
    .attr("y", d => yScale(d.yield))
    .attr("width", xScale.bandwidth())
    .attr("height", d => (height - margin.bottom) - yScale(d.yield));
});