
import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

projectsTitle.textContent = `${projects.length} Projects`;

let query = '';
let selectedYear = null;

const colors = d3.scaleOrdinal(d3.schemeTableau10);

function getFilteredProjects() {
    return projects.filter((project) => {
        let matchesSearch = Object.values(project)
            .join('\n')
            .toLowerCase()
            .includes(query);

        let matchesYear = selectedYear === null ||
            String(project.year) === String(selectedYear);

        return matchesSearch && matchesYear; /*adding this to have it search bothc riterias at the same time */
    });
}

function updateProjects() {
    renderProjects(getFilteredProjects(), projectsContainer, 'h2');
}

function renderPieChart(projectsGiven) {
    let rolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    );

    let data = rolledData.map(([year, count]) => {
        return { value: count, label: year };
    });

    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let sliceGenerator = d3.pie().value((d) => d.value);

    let arcData = sliceGenerator(data);

    let svg = d3.select('#projects-pie-plot');
    let legend = d3.select('.legend');

    svg.selectAll('path').remove();
    legend.selectAll('li').remove();

    function updateSelection() {
        svg
            .selectAll('path')
            .classed('selected', (d) =>
                selectedYear !== null &&
                String(d.data.label) === String(selectedYear)
            );

        legend
            .selectAll('li')
            .classed('selected', (d) =>
                selectedYear !== null &&
                String(d.label) === String(selectedYear)
            );

        updateProjects();
    }

    function toggleYear(year) {
        selectedYear = String(selectedYear) === String(year)
            ? null
            : year;

        updateSelection();
    }

    svg
        .selectAll('path')
        .data(arcData)
        .join('path')
        .attr('d', arcGenerator)
        .attr('fill', (d) => colors(String(d.data.label)))
        .on('click', (event, d) => toggleYear(d.data.label));

    legend
        .selectAll('li')
        .data(data)
        .join('li')
        .attr('class', 'legend-item')
        .style('--color', (d) => colors(String(d.label)))
        .html((d) => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
        .on('click', (event, d) => toggleYear(d.label));

    updateSelection();
}

searchInput.addEventListener('input', (event) => {
    query = event.target.value.toLowerCase();

    let searchResults = projects.filter((project) =>
        Object.values(project)
            .join('\n')
            .toLowerCase()
            .includes(query)
    );

    if (
        selectedYear !== null &&
        !searchResults.some((project) =>
            String(project.year) === String(selectedYear)
        )
    ) {
        selectedYear = null;
    }

    renderPieChart(searchResults);
});

renderPieChart(projects);
