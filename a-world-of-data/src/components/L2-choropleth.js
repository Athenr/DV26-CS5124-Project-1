import * as d3 from "d3";

const width = 800;
const height = 500;
const legendSpace = 80;

const svg = d3.select("#L2-div-choropleth-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const projection = d3.geoNaturalEarth1();
const path = d3.geoPath().projection(projection);

const popup = d3.select("#L2-div-choropleth-popup");

let colorScale = d3.scaleSequential().interpolator(d3.interpolateYlGn);

Promise.all([
    d3.json("/data/world.geojson"),
    d3.csv("/data/cereal-yield.csv"),
    d3.csv("/data/agriculture-share-gdp.csv")
]).then(([world, yieldData, gdpData]) => {

    let selectedRanges = new Set();

    projection.fitSize([width, height - legendSpace], world);
    projection.center([10, 0]);

    // Fixing data
    yieldData.forEach(d => {
        d.Code = d.Code.trim();
        d.Year = +d.Year;
        d.value = +d["Cereals - Yield (tonnes per hectare)"];
    });
    gdpData.forEach(d => {
        d.Code = d.Code.trim();
        d.Year = +d.Year;
        d.value = +d["Agriculture, forestry, and fishing, value added (% of GDP)"];
    });

    // Toggle
    let currentDataset = "yield";

    const toggleButton = svg.append("text")
        .attr("x", 15)
        .attr("y", 25)
        .attr("fill", "black")
        .style("font-size", "14px")
        .style("font-weight", "700")
        .style("cursor", "pointer")
        .text("Switch to Agriculture GDP");
    toggleButton.on("click", () => {
        currentDataset = currentDataset === "yield" ? "gdp" : "yield";
        toggleButton.text(
            currentDataset === "yield"
                ? "Switch to Agriculture GDP"
                : "Switch to Cereal Yield"
        );
        selectedRanges.clear();
        updateLegend();
        updateMap(+slider.node().value);
    });

    const years = Array.from(new Set(yieldData.map(d => d.Year))).sort();

    const slider = d3.select("#L2-div-choropleth-year-slider")
        .attr("min", years[0])
        .attr("max", years[years.length - 1])
        .attr("step", 1)
        .attr("value", years[0]);

    d3.select("#L2-div-choropleth-year-label").text(years[0]);

    function getDataByYear(year) {
        const yearData = {};
        const dataset = currentDataset === "yield" ? yieldData : gdpData;
        dataset.filter(d => d.Year === year).forEach(d => {
            yearData[String(d.Code)] = d.value;
        });
        return yearData;
    }

    function updateColorScale() {
        if (currentDataset === "yield") {
            colorScale.domain([0, 10]);
        } else {
            colorScale.domain([0, 100]);
        }
    }

    function updateMap(year) {

        const yearData = getDataByYear(year);
        updateColorScale();

        svg.selectAll("path")
            .data(world.features)
            .join("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", d => {
                const value = yearData[String(d.id)];
                if (value === undefined) return "#acacac";
                if (selectedRanges.size === 0) {
                    return colorScale(value);
                }
                let allowed = false;
                selectedRanges.forEach(range => {
                    if (
                        (value >= range.min && value < range.max) ||
                        (range.max === Infinity && value >= range.min)
                    ) {
                        allowed = true;
                    }
                });
                return allowed ? colorScale(value) : "#dcdcdc";})
            .on("mouseover", function (event, d) {
                const value = yearData[String(d.id)];
                popup.style("opacity", 1)
                    .html(`
                        <strong>${d.properties.name}</strong><br>
                        ${currentDataset === "yield"
                            ? `Cereal Yield: ${value !== undefined ? value.toFixed(2) + " t/ha" : "No data"}`
                            : `Agriculture GDP: ${value !== undefined ? value.toFixed(2) + "%" : "No data"}`
                        }
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function () {
                popup.style("opacity", 0);
            });
    }

    const latestYear = years[years.length - 1];
    slider.attr("value", latestYear);
    d3.select("#L2-div-choropleth-year-label").text(latestYear);
    updateMap(latestYear);
    slider.on("input", function () {
        const year = +this.value;
        d3.select("#L2-div-choropleth-year-label").text(year);
        updateMap(year);
    });

    // Legend
    const legendWidth = 400;
    const legendHeight = 12;
    const legendMarginBottom = 50;
    const binCount = 10;
    const [min, max] = colorScale.domain();
    const step = (max - min) / binCount;
    const legendBins = d3.range(binCount).map(i => {
        const binMin = min + i * step;
        const binMax = (i === binCount - 1)
            ? Infinity
            : min + (i + 1) * step;
        return {
            index: i,
            min: binMin,
            max: binMax
        };
    });

    const legendScale = d3.scaleLinear()
        .domain([min, max])
        .range([0, legendWidth]);
    const legendGroup = svg.append("g")
        .attr("transform",
            `translate(${(width - legendWidth) / 2},
        ${height - legendMarginBottom})`);

    const binWidth = legendWidth / binCount;

    legendGroup.selectAll("rect")
        .data(legendBins)
        .enter()
        .append("rect")
        .attr("x", d => d.index * binWidth)
        .attr("y", 0)
        .attr("width", binWidth)
        .attr("height", legendHeight)
        .attr("fill", d => colorScale((d.min + d.max) / 2))
        .attr("stroke", "#000")
        .attr("stroke-width", 0.8)
        .on("mouseover", function () {
            d3.select(this).attr("stroke-width", 3);})
        .on("mouseout", function () {
            const d = d3.select(this).datum();
            if (!selectedRanges.has(d)) {
                d3.select(this).attr("stroke-width", 1);
            }})
        .on("click", function (event, d) {
            if (selectedRanges.has(d)) {
                selectedRanges.delete(d);
                d3.select(this).classed("selected", false);
            } else {
                selectedRanges.add(d);
                d3.select(this).classed("selected", true);
            }
            updateMap(+slider.node().value);
            legendGroup.selectAll("rect")
                .attr("stroke-width", r =>
                    selectedRanges.has(r) ? 3 : 1
                );});

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(10)
        .tickPadding(5)
        .tickSize(0)
        .tickFormat(d => {
            if (currentDataset === "yield") {
                return d >= 10 ? "10.0+" : d3.format(".1f")(d);
            } else {
                return d >= 100 ? "100+" : d3.format(".1f")(d);
            }
        });
    const axisGroup = legendGroup.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis);

    axisGroup.selectAll("text")
        .style("fill", "black");

    axisGroup.select(".domain").remove();

    const legendTitle = legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", 700);

    function updateLegend() {
        updateColorScale();
        const [min, max] = colorScale.domain();
        const step = (max - min) / binCount;
        legendBins.forEach((bin, i) => {
            bin.min = min + i * step;
            bin.max = (i === binCount - 1)
                ? Infinity
                : min + (i + 1) * step;
        });
        legendScale.domain(colorScale.domain());
        const midpoint = d => {
            if (d.max === Infinity) return max;
            return (d.min + d.max) / 2;
        };
        legendGroup.selectAll("rect")
            .data(legendBins)
            .attr("fill", d => colorScale(midpoint(d)))
            .attr("stroke-width", r => selectedRanges.has(r) ? 3 : 1);
        axisGroup.call(legendAxis);
        axisGroup.selectAll("text").style("fill", "black");
        axisGroup.select(".domain").remove();
        legendTitle.text(currentDataset === "yield" ? "Cereal Yield (tonnes per hectare)" : "Agriculture GDP Share (%)");
    }

    updateLegend();
});