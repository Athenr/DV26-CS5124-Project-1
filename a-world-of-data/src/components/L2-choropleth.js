import * as d3 from "d3";

const width = 800;
const height = 550;
const legendSpace = 80;

const svg = d3.select("#L2-div-choropleth-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const projection = d3.geoNaturalEarth1();
const path = d3.geoPath().projection(projection);

const popup = d3.select("#L2-div-choropleth-popup");

const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateYlGn)
    .domain([0, 10]);

Promise.all([
    d3.json("/data/world.geojson"),
    d3.csv("/data/cereal-yield.csv")
]).then(([world, data]) => {

    let selectedRanges = new Set();

    projection.fitSize([width, height - legendSpace], world);
    projection.center([10, 0]);

    data.forEach(d => {
        d.Code = d.Code.trim();
        d.Year = +d.Year;
        d["Cereals - Yield (tonnes per hectare)"] =
            +d["Cereals - Yield (tonnes per hectare)"];
    });

    const years = Array.from(new Set(data.map(d => d.Year))).sort();

    const slider = d3.select("#L2-div-choropleth-year-slider")
        .attr("min", years[0])
        .attr("max", years[years.length - 1])
        .attr("step", 1)
        .attr("value", years[0]);

    d3.select("#L2-div-choropleth-year-label").text(years[0]);

    function getDataByYear(year) {
        const yearData = {};
        data.filter(d => d.Year === year)
            .forEach(d => {
                yearData[String(d.Code)] = d["Cereals - Yield (tonnes per hectare)"];
            });
        return yearData;
    }

    function updateMap(year) {

        const yearData = getDataByYear(year);

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
                        Cereal Yield: ${value !== undefined ? value.toFixed(5) + " t/ha" : "No data"}
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
            if (d >= max) return "10.0+";
            return d3.format(".1f")(d);
        });
    const axisGroup = legendGroup.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis);

    axisGroup.select(".domain").remove();

    legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", 700)
        .text("Cereal Yield (tonnes per hectare)");
});