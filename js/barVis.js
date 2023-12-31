/* * * * * * * * * * * * * *
*        ScatterVis        *
* * * * * * * * * * * * * */


class BarVis {

    // constructor method to initialize Timeline object
    constructor(parentElement, covidData, usaData, descending = true) {
        this.parentElement = parentElement;
        this.covidData = covidData;
        this.usaData = usaData;
        this.displayData = [];
        this.descending = descending;

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis() {
        let vis = this;

        //
        let colors = ["#FFFFFF", "#136D70"]
        vis.colorScale = d3.scaleLinear().range(colors)

        vis.margin = {top: 20, right: 20, bottom: 20, left: 40};
        vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append('g')
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // add title
        vis.svg.append('g')
            .attr('class', 'title bar-title')
            .append('text')
            // .text('Barchat')
            .attr('transform', `translate(${vis.width / 2}, 10)`)
            .attr('text-anchor', 'middle');


        // tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'barTooltip')

        // axis groups
        vis.xAxisGroup = vis.svg.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate (0,${vis.height})`);

        vis.yAxisGroup = vis.svg.append('g')
            .attr('class', 'axis y-axis');

        // having initialized the map, move on to wrangle data
        this.wrangleData();
    }

    wrangleData() {
        let vis = this

        // check out the data
        // console.log(tableObject.covidData)
        // console.log(tableObject.usaData)

        // first, filter according to selectedTimeRange, init empty array
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0) {
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            vis.covidData.forEach(row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime()) {
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d => d.state), ([key, value]) => ({key, value}))

        // have a look
        // console.log(covidDataByState)

        // init final data structure in which both data sets will be merged into
        vis.displayData = []

        // merge
        covidDataByState.forEach(state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            vis.usaData.forEach(row => {
                if (row.state === stateName) {
                    population += +row["2020"].replaceAll(',', '');
                }
            })

            // calculate new cases by summing up all the entries for each state
            state.value.forEach(entry => {
                newCasesSum += +entry['new_case'];
                newDeathsSum += +entry['new_death'];
            });

            // populate the final data structure
            vis.displayData.push(
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum / population * 100),
                    relDeaths: (newDeathsSum / population * 100)
                }
            )
        })

        if (vis.descending) {
            vis.displayData.sort((a, b) => {
                return b[selectedCategory] - a[selectedCategory]
            })
        } else {
            vis.displayData.sort((a, b) => {
                return a[selectedCategory] - b[selectedCategory]
            })
        }


        vis.topTenData = vis.displayData.slice(0, 10)

        vis.updateVis()

    }

    updateVis() {
        let vis = this;

        let colors = ["#FFFFFF", "#136D70"]
        vis.colorScale = d3.scaleLinear()
            .range(colors)
            .domain([0, d3.max(vis.displayData, d => d[selectedCategory])]) // use display data for entire domain, otherwise you're lying with data

        // scale for x axis
        vis.xScale = d3.scaleBand()
            .domain((vis.topTenData).map(d => d.state))
            .range([0, vis.width])
            .round(true)
            .padding(.1)

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0])
            .domain([0, d3.max(vis.topTenData, d => d[selectedCategory])])

        // axis
        vis.xAxisGroup.transition().duration(500).call(d3.axisBottom(vis.xScale))
        vis.yAxisGroup.transition().duration(500).call(d3.axisLeft(vis.yScale))

        vis.xAxisGroup.select(".domain")
            .attr("stroke","grey")
            .attr("stroke-width","0.5")
            .attr("opacity",".6");

        vis.yAxisGroup.select(".domain")
            .attr("stroke","grey")
            .attr("stroke-width","0.5")
            .attr("opacity",".6");

        // draw bars
        vis.bars = vis.svg.selectAll("rect").data(vis.topTenData, d => d.state)

        vis.bars.enter().append('rect')
            .merge(vis.bars)
            .attr('class', d => "topTenBars " + d.state)
            .attr('y', d => vis.yScale(d[selectedCategory]))
            .attr('height', d => vis.height - vis.yScale(d[selectedCategory]))
            .attr('width', vis.xScale.bandwidth())
            .on('mouseover', function (event, d) {

                // update color of hovered state
                d3.select(this)
                    .attr('fill', 'rgb(255,129,129)')
                    .style('opacity', 1)

                // update tooltip
                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px")
                    .html(`
                        <div style=" border-radius: 5px; background: whitesmoke; padding: 20px; box-shadow:4px 4px 8px 4px rgba(184,184,184,0.32)">
                            <h3 style="font-size:16px;font-family: Avenir">${d.state}<h3>
                            <h4 style="font-size:10px;font-family: Avenir"> Population: ${d.population}</h4>
                            <h4 style="font-size:10px;font-family: Avenir"> Cases (absolute): ${d.absCases}</h4>
                            <h4 style="font-size:10px;font-family: Avenir"> Deaths (absolute): ${d.absDeaths}</h4>
                            <h4 style="font-size:10px;font-family: Avenir"> Cases (relative): ${d.relCases.toFixed(2)}%</h4>
                            <h4 style="font-size:10px;font-family: Avenir"> Deaths (relative): ${d.relDeaths.toFixed(2)}%</h4>
                        </div>`);
            })
            .on('mouseout', function (event, d) {
                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0 + "px")
                    .style("top", 0 + "px")

                d3.select(this)
                    .attr('stroke-width', .1)
                    .attr('stoke', '#000000')
                    .attr('fill', d => vis.colorScale(d[selectedCategory]));
            })
            .transition()
            .duration(1000)
            .attr('x', d => vis.xScale(d.state))
            .attr('y', d => vis.yScale(d[selectedCategory]))
            .attr('height', d => vis.height - vis.yScale(d[selectedCategory]))
            .attr('stroke-width', .1)
            .attr('stroke', '#000000')
            .attr('fill', d => vis.colorScale(d[selectedCategory]));

        vis.bars.exit().remove()

    }


}