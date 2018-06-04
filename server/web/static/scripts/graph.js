/*
google.charts.load('current', {packages: ['corechart', 'table']});

google.charts.setOnLoadCallback(requestData);

let graphOptions = {
    // areaOpacity: 0.0, // maybe
    legend: 'right',
    title: 'Top Team Scores',
    width: 500,
    height: 300,
    animation: {
        startup: true,
        duration: 1000,
        easing: 'out'
    },
    pointSize: 3,
    interpolateNulls: true, //maybe not. it is not rendering the first datapoint of team d.
    vAxis: {
        minValue: 0,
        maxValue: 200,
        title: 'Points'
    },
    hAxis: {
        title: 'Time',
        ticks: []
    }
}

function requestData(){
    // drawChart(null);
    $.get('/api/graph').then((data) => {
        drawChart(data);
    });
    // setInterval(requestData, 5000);
}

function drawChart(d){
    let data_list = d.map((stuff) => {
        stuff.rows = stuff.rows.map((row) => {
            let date_string = row.c.shift().v;
            row.c.unshift({v: new Date(date_string)});
            return row;
        });
        console.log(stuff);
        return new google.visualization.DataTable(stuff);
    });
    let reduceCols = [];
    let counter = 1;
    let data = data_list.reduce((acc, el) => {
        reduceCols.push(counter);
        counter += 1;
        try{
            return google.visualization.data.join(acc, el, 'full', [[0,0]], reduceCols, [1]);
        }catch(e){console.log(e)}
    });
    //AreaChart
    //SteppedAreaChart
    var chart = new google.visualization.AreaChart(document.getElementById('graph'));
    chart.draw(data, graphOptions);
    var table = new google.visualization.Table(document.getElementById('table'));
    table.draw(data,null);
}
*/

let graphOptions = {
    spanGaps: true,
    steppedLine: true,
    bezierCurve: false,
    elements: {
            line: {
                tension: 0, // disables bezier curves
            }
        },
    scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true,
                    min: 0,
                    suggestedMax: 200
                },
                scaleLabel: {
                    display: true,
                    label: "Score"
                }
            }],
            xAxes: [{
                type: 'time',
                bounds: 'data'
            }]
        },
    legend: {
        position: 'right'
    }
}

function requestData(){
    $.get('/api/graph').then((data) => {
        drawChart(data);
    });
}

function drawChart(d){
    var ctx = document.getElementById('graph').getContext('2d');
    var graph = new Chart(ctx, {
        // The type of chart we want to create
        type: 'line',

        // The data for our dataset
        data: d,
        // {
        //     labels: ["January", "February", "March", "April", "May", "June", "July"],
        //     datasets: [{
        //         label: "My First dataset",
        //         backgroundColor: 'rgb(255, 99, 132)',
        //         borderColor: 'rgb(255, 99, 132)',
        //         data: [0, 10, 5, 2, 20, 30, 45],
        //     }]
        // },

        // Configuration options go here
        options: graphOptions
    });
}

$(document).ready(function(){
    requestData();
    // setInterval(requestData, 5000);
})
