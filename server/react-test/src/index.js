import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import './normalize.css'
import './TeamList.css';

class Team extends Component {
    render() {
        return (
            <tr onClick={this.props.onClick}>
                <td>{this.props.rank}</td>
                <td>{this.props.name}</td>
                <td>{this.props.school}</td>
                <td>{this.props.points}</td>
            </tr>

        )
    }
}

class TeamList extends Component {
    constructor(props) {
        super(props);
        this.state = window.initialState || {
            teams: [
                {name: "a", school: "The Best School", points: 10, rank: 1, _id: "13841"},
                {name: "Yes", school: "Another", points: 8, rank: 2, _id: "8510311"}
            ]
        };
    }
    handleClick(teamid){
        window.location.href = "/team/"+teamid;
    }
    render() {
        return (
            <div>
                <table className="teamTable">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team Name</th>
                            <th>School</th>
                            <th>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.state.teams.map((team, index) =>
                            <Team key={team._id} rank={index + 1} name={team.name} school={team.school} points={team.points} onClick={() => this.handleClick(team._id)}/>
                        )}
                    </tbody>
                </table>
            </div>
        );
    }
}

ReactDOM.render(<TeamList />, document.getElementById('root'));
