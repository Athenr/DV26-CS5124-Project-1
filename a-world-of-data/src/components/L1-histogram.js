import * as d3 from "d3";

if (!window.selectedRanges) {
    window.selectedRanges = new Set();
}

const width = 800;
const height = 500;
const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const svg = d3.select("#L1-div-histogram-chart")
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
    .text("Agriculture GDP Share");

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
    .text("Agriculture GDP Share (%)");
svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("fill", "#c4c4c4")
    .style("font-weight", "600")
    .text("Country Count");

// CSVs
Promise.all([
    d3.csv("/data/agriculture-share-gdp.csv", d3.autoType),
    d3.csv("/data/country_codes_and_continents.csv", d3.autoType)
]).then(([gdpData, continentData]) => {

    // Year slider thing
    const years = [...new Set(gdpData.map(d => d.Year))].sort();

    const slider = d3.select("#L1-div-histogram-year-slider")
        .attr("min", d3.min(years))
        .attr("max", d3.max(years))
        .attr("step", 1)
        .property("value", years[0]);

    d3.select("#L1-div-histogram-year-label").text(years[0]);

    slider.on("input", function() {
        const year = +this.value;
        d3.select("#L1-div-histogram-year-label").text(year);
        update(year);
    });

    // Continent stuff
    const continentMap = new Map(
        continentData.map(d => [d["Country Code"], d.Continent])
    );

    const colorScale = d3.scaleOrdinal()
        .domain([
            "Africa",
            "Asia",
            "Europe",
            "North America",
            "South America",
            "Oceania"
        ])
        .range([
            "#ff5757", // AF
            "#ff9c4a", // AS
            "#26b9a8", // EU
            "#4960e0", // NA
            "#7fda61", // SA
            "#8e3fc4"  // OC
        ]);

    // Continent legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 145}, ${30})`);
    const continents = colorScale.domain();
    const legendGroup = legend.selectAll(".legend-item")
        .data(continents)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 25})`);
    legendGroup.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 3)
        .attr("fill", d => colorScale(d))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7);
    legendGroup.append("text")
        .attr("x", 22)
        .attr("y", 11)
        .style("fill", "#ffffff")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .text(d => d);

    legendGroup.style("cursor", "pointer");

    function refreshLegend() {
        legendGroup
            .transition()
            .duration(100)
            .attr("opacity", r => {
                if (window.selectedRanges.size === 0) return 1;
                return window.selectedRanges.has(r) ? 1 : 0.5;
            });
        legendGroup.selectAll("rect").attr("stroke-width", r =>
            window.selectedRanges.has(r) ? 2.5 : 0.7
        );
        legendGroup.selectAll("text").style("font-weight", r =>
            window.selectedRanges.has(r) ? "700" : "600"
        );
    }

    legendGroup.on("click", function (event, d) {
        if (window.selectedRanges.has(d)) {
            window.selectedRanges.delete(d);
        } else {
            window.selectedRanges.add(d);
        }
        refreshLegend();

        update(+slider.node().value);
        window.dispatchEvent(new Event("selectedFilterChanged"));
    });

function update(selectedYear) {
    const gdpFiltered = gdpData.filter(d => d.Year === selectedYear);

    const gdpAll = gdpFiltered.map(d => ({
        Entity: d.Entity || d.entity,
        Code: d.Code,
        gdp: d["Agriculture, forestry, and fishing, value added (% of GDP)"],
        continent: continentMap.get(d.Code) || "Unknown"
    })).filter(d => d.continent !== "Unknown");
    let gdpFinalized = gdpAll;
    if (window.selectedRanges.size > 0) {
        gdpFinalized = gdpAll.filter(d =>
            window.selectedRanges.has(d.continent)
        );
    }

    const stackOrder = colorScale.domain(); 

    xScale.domain([0, 100]).nice();

    const histogram = d3.bin()
        .value(d => d.gdp)
        .domain(xScale.domain())
        .thresholds(xScale.ticks(20));

    const binsAll = histogram(gdpAll);
    const binsFiltered = histogram(gdpFinalized);

    const stackedData = [];
    binsFiltered.forEach(bin => {
        const grouped = d3.groups(bin, d => d.continent);
        grouped.sort((a, b) => stackOrder.indexOf(a[0]) - stackOrder.indexOf(b[0]));

        let cumulative = 0;
        grouped.forEach(([continent, values]) => {
            const count = values.length;
            stackedData.push({
                x0: bin.x0,
                x1: bin.x1,
                continent: continent,
                count: count,
                y0: cumulative,
                y1: cumulative + count
            });
            cumulative += count;
        });
    });

    yScale.domain([0, d3.max(binsAll, d => d.length)]).nice();
    xAxisGroup.call(d3.axisBottom(xScale));
    yAxisGroup.call(d3.axisLeft(yScale));

    const bars = svg.selectAll(".bar-segment")
        .data(stackedData, d => d.x0 + d.continent);

    bars.join(
        enter => enter.append("rect")
            .attr("class", "bar-segment")
            .attr("x", d => xScale(d.x0) + 1)
            .attr("width", d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
            .attr("y", yScale(0))
            .attr("height", 0),
        update => update,
        exit => exit.attr("height", 0).attr("y", yScale(0)).remove()
    )
    .attr("x", d => xScale(d.x0) + 1)
    .attr("width", d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
    .attr("y", d => yScale(d.y1))
    .attr("height", d => yScale(d.y0) - yScale(d.y1))
    .attr("fill", d => colorScale(d.continent))
    .attr("stroke", "#1a1a1a")
    .attr("stroke-width", "0.5px");
}

    window.addEventListener("selectedFilterChanged", () => {
        refreshLegend();
        update(+slider.node().value);
    });

    update(years[0]);
});