
import React from 'react';
import Axios from 'axios';
import './App.css';

const authEndpoint = 'https://accounts.spotify.com/authorize'
const redirectUri = 'http://localhost:3000'

const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-modify-public'
];

const searchTime = 500;

const hash = window.location.hash.substring(1)
                                 .split('&')
                                 .reduce((initial, item) => {
                                    if(item) {
                                        var parts = item.split('=');
                                        initial[parts[0]] = decodeURIComponent(parts[1]);
                                    }

                                    return initial;
                                 }, {});

function LoginButton(props) {
  return (
    <a href={`${authEndpoint}?client_id=${props.clientId}&redirect_uri=${redirectUri}&scopes=${scopes.join('%20')}&response_type=token&show_dialog=true`}>
      <button>
        Login to Spotify
      </button>
    </a>
  );
}


function limit(text, chars=25) {
  let ret = text;
  if(text.length >= chars) {
    ret = ret.substring(0, chars) + "...";
  }

  return ret;
}

function Song(props) {
  let onSelect = () => props.onSelect(props.track);
  return (
    <div className="song" onClick={onSelect}>
      <img src={props.track.album.images[2].url} alt={props.track.album.name}></img>
      <div>
        <p>{limit(props.track.name)}</p>
        <p>{limit(props.track.artists[0].name)}</p>
        <p>{limit(props.track.album.name)}</p>
      </div>
    </div>
  );
}

class SearchBar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      searchValue: "",
      searchPrevious: "",
      searchTracks: undefined,
      searchInterval: undefined,
      accessToken: props.accessToken,
      selectedTracks: []
    };

    this.search = this.search.bind(this);
    this.stringify = this.stringify.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSelectTrack = this.handleSelectTrack.bind(this);
    this.handleDeselectTrack = this.handleDeselectTrack.bind(this);
  }

  searchify(text) {
    return text.replace(/\s/g, '%20');
  }

  stringify(json) {
    let keys = Object.keys(json);
    let ret = "";
    keys.forEach(val => {
      ret += val + "=" + this.searchify(json.val) + "&";
    });

    return ret;
  }

  async search() {
    if(this.state.searchValue.length < 3 || this.state.searchValue === this.state.searchPrevious) {
      this.setState({
        searchTracks: undefined
      })
      return false;
    }

    const response = 
      await Axios.get('https://api.spotify.com/v1/search', 
        {params: {
          q: this.state.searchValue,
          type: 'track',
          limit: 10
        },
        headers: {
          Authorization: 'Bearer ' + this.state.accessToken
        }});

    this.setState({
      searchTracks: response.data.tracks.items
    });
  }

  handleFocus() {
    this.setState({
      searchInterval: setInterval(this.search, searchTime)
    });
  }

  handleBlur() {
    if(this.state.searchInterval) {
      this.search();
      clearInterval(this.state.searchInterval);
    }
  }

  handleChange(event) {
    let searchInterval = this.state.searchInterval;
    if(searchInterval) {
      clearInterval(searchInterval);
      searchInterval = setInterval(this.search, searchTime);
    }

    this.setState({
      searchValue: event.target.value,
      searchInterval: searchInterval
    });
  }

  handleSelectTrack(track) {
    let newTracks = this.state.selectedTracks;
    newTracks.push(track);

    this.setState({
      selectedTracks: newTracks
    });
  }

  handleDeselectTrack(track) {
    let newTracks = this.state.selectedTracks.filter(val => val !== track);

    this.setState({
      selectedTracks: newTracks
    })
  }

  render() {
    return (
      <div className="song-display">
        <div className="song-search flex-center">
          <div className="search-bar">
            <input className="search" type="text" placeholder="Search" aria-label="Search" onFocus={this.handleFocus} onChange={this.handleChange} onBlur={this.handleBlur}></input>
          </div>
          <div className="search-results">
            {this.state.searchTracks && this.state.searchTracks.map((val, ind) => (<Song track={val} onSelect={this.handleSelectTrack} key={"search-" + ind}></Song>))}
          </div>
        </div>
        <div className="song-list flex-center">
          {this.state.selectedTracks && this.state.selectedTracks.map((val, ind) => (<Song track={val} onSelect={this.handleDeselectTrack} key={"list-" + ind}></Song>))}
          <button>Generate</button>
        </div>
      </div>
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      clientId: "11d45ba62abd4480bea0d54ad7e9c685",
      access_token: undefined
    }
  }

  componentDidMount() {
    if(hash.access_token) {
      this.setState({
        accessToken: hash.access_token
      })
    }
  }

  render() {
    return (
      <div className="app">
        <header className="header flex-center">
          <h1>MELOFY</h1>
          <p>Bottom Text.</p>
        </header>

        <div className="main flex-center">
          {this.state.accessToken
            ? <SearchBar accessToken={this.state.accessToken} />
            : <LoginButton clientId={this.state.clientId} />}
        </div>
      </div>
    );
  }
}

export default App;
