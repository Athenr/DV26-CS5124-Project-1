import * as d3 from "d3";

const width = 800;
const height = 500;
const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const svg = d3.select("#L1-div-scatterplot-chart")
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
    .text("Cereal Yield vs Agriculture GDP Share");

const xScale = d3.scaleLinear()
    .range([margin.left, width - margin.right]);
const yScale = d3.scaleLinear()
    .range([height - margin.bottom, margin.top]);
const xAxisGroup = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`);
const yAxisGroup = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`);
svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 15)
    .attr("text-anchor", "middle")
    .style("fill", "#c4c4c4")
    .style("font-weight", "600")
    .text("Cereal Yield (tonnes per hectare)");
svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("fill", "#c4c4c4")
    .style("font-weight", "600")
    .text("Agriculture GDP Share (%)");

// CSVs
Promise.all([
    d3.csv("/data/cereal-yield.csv", d3.autoType),
    d3.csv("/data/agriculture-share-gdp.csv", d3.autoType)
]).then(([yieldData, gdpData]) => {

    // Year slider thing
    const years = [...new Set(yieldData.map(d => d.Year))].sort();

    const slider = d3.select("#L1-div-scatterplot-year-slider")
        .attr("min", d3.min(years))
        .attr("max", d3.max(years))
        .attr("step", 1)
        .property("value", years[0]);

    d3.select("#L1-div-scatterplot-year-label").text(years[0]);

    slider.on("input", function() {
        const year = +this.value;
        d3.select("#L1-div-scatterplot-year-label").text(year);
        update(year);
    });

    function update(selectedYear) {

        const yieldFiltered = yieldData.filter(d => d.Year === selectedYear);
        const gdpFiltered = gdpData.filter(d => d.Year === selectedYear);

        // Merge
        const merged = yieldFiltered.map(d => {
            const match = gdpFiltered.find(g => g.Code === d.Code);
            if (match) {
                return {
                    Entity: d.Entity,
                    Code: d.Code,
                    yield: d["Cereals - Yield (tonnes per hectare)"],
                    gdp: match["Agriculture, forestry, and fishing, value added (% of GDP)"]
                };
            }
        }).filter(d => d && d.yield && d.gdp);

        xScale.domain([0, d3.max(merged, d => d.yield)]);
        yScale.domain([0, d3.max(merged, d => d.gdp)]);
        xAxisGroup.call(d3.axisBottom(xScale));
        yAxisGroup.call(d3.axisLeft(yScale));

        const circles = svg.selectAll("circle")
            .data(merged, d => d.Code);

        circles.enter()
            .append("circle")
            .attr("cx", d => xScale(d.yield))
            .attr("cy", d => yScale(d.gdp))
            .attr("r", 5)
            .attr("fill", "#7DBD77")
            .attr("opacity", 0.85)
            .attr("stroke", "#436540")
            .attr("stroke-width", 1.5)
            .on("mouseover", function () {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("r", 7);
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("r", 5)
            })
            .merge(circles)
            .transition()
            .duration(250)
            .attr("cx", d => xScale(d.yield))
            .attr("cy", d => yScale(d.gdp));

        circles.exit().remove();
    }

    update(years[0]);
});