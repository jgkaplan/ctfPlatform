import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import './TeamList.css';

class Team extends Component {
    render() {
        return (
            <tr onClick={this.props.onClick}>
                <td>{this.props.rank}</td>
                <td>{this.props.name}</td>
                <td>{this.props.points}</td>
            </tr>

        )
    }
}

class TeamList extends Component {
    constructor(props) {
        super(props);
        this.state = {teams: window.initialState} || {
            teams: [
                {name: "a", school: "The Best School", score: 10, _id: "13841"},
                {name: "Yes", school: "Another", score: 8, _id: "8510311"}
            ]
        };
    }
    handleClick(teamid){
        window.location.href = "/team/"+teamid;
    }
    getTeams() {
        $.get('/api/teams').done((data) => {
            this.setState(data);
        });
    }
    componentDidMount() {
        this.refreshTeamsInterval = setInterval(() => this.getTeams(), 5000);
    }
    componentWillUnmount() {
        clearInterval(this.refreshTeamsInterval)
    }
    render() {
        return (
            <div>
                <table className="teamTable">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team Name</th>
                            <th>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.state.teams.map((team, index) =>
                            <Team key={team._id} rank={index + 1} name={team.teamname} points={team.score} onClick={() => this.handleClick(team._id)}/>
                        )}
                    </tbody>
                </table>
            </div>
        );
    }
}

ReactDOM.render(<TeamList />, document.getElementById('teamlist'));
