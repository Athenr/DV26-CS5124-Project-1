import * as d3 from "d3";

const width = 800;
const height = 550;

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

    projection.fitSize([width, height], world);

    data.forEach(d => {
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
                yearData[d.Code] = d["Cereals - Yield (tonnes per hectare)"];
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
                const value = yearData[d.id];
                return value ? colorScale(value) : "#ccc";
            })
            .on("mouseover", function(event, d) {
                const value = yearData[d.id];
                popup.style("opacity", 1)
                    .html(`
                        <strong>${d.properties.name}</strong><br>
                        Cereal Yield: ${value ? value.toFixed(2) + " t/ha" : "No data"}
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                popup.style("opacity", 0);
            });
    }

    // Initial render
    updateMap(years[0]);

    // Slider event
    slider.on("input", function() {
        const year = +this.value;
        d3.select("#L2-div-choropleth-year-label").text(year);
        updateMap(year);
    });

});