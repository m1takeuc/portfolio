import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    return await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime)
    }));
}

function processCommits(data) {
    return d3.groups(data, d => d.commit).map(([commit, lines]) => {
        const first = lines[0];
        const { author, date, time, timezone, datetime } = first;

        const result = {
            id: commit,
            url: `https://github.com/m1takeuc/portfolio/commit/${commit}`,
            author,
            date,
            time,
            timezone,
            datetime,
            hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
            totalLines: lines.length
        };

        Object.defineProperty(result, 'lines', {
            value: lines,
            enumerable: false
        });

        return result;
    });
}

function renderCommitInfo(data, commits) {
    const files = d3.group(data, d => d.file);

    const stats = [
        ['Total LOC', data.length.toLocaleString()],
        ['Total commits', commits.length.toLocaleString()],
        ['Total files', files.size.toLocaleString()],
        ['Average line length', d3.format('.1f')(d3.mean(data, d => d.length) ?? 0)],
        ['Maximum nesting depth', d3.max(data, d => d.depth) ?? 0],
        ['Total authors', new Set(commits.map(d => d.author)).size]
    ];

    d3.select('#stats')
        .append('dl')
        .attr('class', 'stats')
        .selectAll('div')
        .data(stats)
        .join('div')
        .html(d => `<dt>${d[0]}</dt><dd>${d[1]}</dd>`);
}

function renderTooltipContent(commit) {
    const link = d3.select('#commit-link');

    link
        .attr('href', commit.url)
        .text(commit.id.slice(0, 7));

    d3.select('#commit-date').text(commit.datetime.toLocaleDateString());
    d3.select('#commit-time').text(commit.datetime.toLocaleTimeString());
    d3.select('#commit-author').text(commit.author);
    d3.select('#commit-lines').text(commit.totalLines);
}

function updateTooltipVisibility(isVisible) {
    d3.select('#commit-tooltip').property('hidden', !isVisible);
}

function updateTooltipPosition(event) {
    d3.select('#commit-tooltip')
        .style('left', `${event.clientX + 15}px`)
        .style('top', `${event.clientY + 15}px`);
}

function renderSelectionCount(selectedCommits) {
    d3.select('#selection-count').text(
        selectedCommits.length
            ? `${selectedCommits.length} commits selected`
            : 'No commits selected'
    );
}

function renderLanguageBreakdown(selectedCommits) {
    const container = d3.select('#language-breakdown');
    container.selectAll('*').remove();

    if (!selectedCommits.length) {
        return;
    }

    const lines = selectedCommits.flatMap(commit => commit.lines);
    const languages = d3.rollups(
        lines,
        values => values.length,
        line => line.type || 'Unknown'
    ).sort((a, b) => b[1] - a[1]);

    container
        .append('dl')
        .attr('class', 'stats')
        .selectAll('div')
        .data(languages)
        .join('div')
        .html(([language, count]) => `
            <dt>${language}</dt>
            <dd>${count.toLocaleString()} lines (${d3.format('.1~%')(count / lines.length)})</dd>
        `);
}

function renderScatterplot(commits) {
    const width = 1000;
    const height = 600;
    const margin = { top: 10, right: 30, bottom: 40, left: 55 };
    const usableWidth = width - margin.left - margin.right;
    const usableHeight = height - margin.top - margin.bottom;

    const svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3.scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([0, usableWidth])
        .nice();

    const yScale = d3.scaleLinear()
        .domain([0, 24])
        .range([usableHeight, 0]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(commits, d => d.totalLines) || 1])
        .range([2, 30]);

    chart.append('g')
        .attr('class', 'gridlines')
        .call(
            d3.axisLeft(yScale)
                .tickSize(-usableWidth)
                .tickFormat('')
        );

    chart.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${usableHeight})`)
        .call(d3.axisBottom(xScale));

    chart.append('g')
        .attr('class', 'y-axis')
        .call(
            d3.axisLeft(yScale)
                .tickFormat(d => `${String(d % 24).padStart(2, '0')}:00`)
        );

    const dots = chart.append('g')
        .attr('class', 'dots');

    const circles = dots.selectAll('circle')
        .data(d3.sort(commits, d => -d.totalLines))
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => radiusScale(d.totalLines))
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.7)
        .on('mouseenter', function (event, commit) {
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
            d3.select(this).attr('fill-opacity', 1);
        })
        .on('mousemove', function (event) {
            updateTooltipPosition(event);
        })
        .on('mouseleave', function () {
            updateTooltipVisibility(false);
            d3.select(this).attr('fill-opacity', 0.7);
        });

    const brush = d3.brush()
        .extent([[0, 0], [usableWidth, usableHeight]])
        .on('start brush end', function (event) {
            const selection = event.selection;

            const selectedCommits = selection
                ? commits.filter(commit => {
                    const x = xScale(commit.datetime);
                    const y = yScale(commit.hourFrac);

                    return (
                        x >= selection[0][0] &&
                        x <= selection[1][0] &&
                        y >= selection[0][1] &&
                        y <= selection[1][1]
                    );
                })
                : [];

            circles.classed(
                'selected',
                commit => selectedCommits.includes(commit)
            );

            renderSelectionCount(selectedCommits);
            renderLanguageBreakdown(selectedCommits);
        });

    chart.append('g')
        .attr('class', 'brush')
        .call(brush);

    dots.raise();
}

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterplot(commits);
