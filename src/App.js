
import React from 'react';
import Axios from 'axios';
import qs from 'querystring';
import { withCookies } from 'react-cookie';
import { createBrowserHistory } from 'history';
import './App.css';

const authEndpoint = 'https://accounts.spotify.com/authorize'
const redirectUri = 'http://localhost:3000'

const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-modify-public',
];

const searchTime = 500;

const hash = window.location.href.split('?').length > 1 && 
             window.location.href.split('?')[1]
                                 .split('&')
                                 .reduce((initial, item) => {
                                    if(item) {
                                        var parts = item.split('=');
                                        initial[parts[0]] = decodeURIComponent(parts[1]);
                                    }

                                    return initial;
                                 }, {});

// encoding functions pulled from https://stackoverflow.com/questions/59911194/how-to-calculate-pckes-code-verifier/59913241#59913241
    function sha256(plain) { 
        // returns promise ArrayBuffer
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return window.crypto.subtle.digest('SHA-256', data);
    }

    function base64urlencode(a) {
        // Convert the ArrayBuffer to string using Uint8 array.
        // btoa takes chars from 0-255 and base64 encodes.
        // Then convert the base64 encoded to base64url encoded.
        // (replace + with -, replace / with _, trim trailing =)
        return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    async function makeChallenge(v) {
        const hashed = await sha256(v);
        const base64encoded = base64urlencode(hashed);
        return base64encoded;
    }
// end pull

function makeVerifier(lengthMin, lengthMax) {
  let length = (Math.random() * (lengthMax - lengthMin)) + lengthMin;

  let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-";
  let ret = "";
  for(var i = 0; i < length; ++i) {
    ret += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return ret;
}

function LoginButton(props) {
  return (
    <a href={
      `${authEndpoint}?response_type=code&client_id=${props.clientId}&redirect_uri=${redirectUri}&code_challenge_method=S256&code_challenge=${props.challenge}&scope=${scopes.join('%20')}&show_dialog=true`}>
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
      selectedTracks: [],
      recommendedTracks: []
    };

    this.search = this.search.bind(this);
    this.recommendations = this.recommendations.bind(this);
    this.generatePlaylist = this.generatePlaylist.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSelectTrack = this.handleSelectTrack.bind(this);
    this.handleDeselectTrack = this.handleDeselectTrack.bind(this);
  }

  searchify(text) {
    return text.replace(/\s/g, '%20');
  }

  async search() {
    if(this.state.searchValue.length < 3 || this.state.searchValue === this.state.searchPrevious || !this.state.accessToken) {
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

  async recommendations() {
    if(this.state.selectedTracks.length <= 0 || !this.state.accessToken) {
      return false;
    }

    const promises = this.state.selectedTracks.map(async val => {
      const response =
        await Axios.get('https://api.spotify.com/v1/recommendations',
          {params: {
            seed_tracks: val.id
          },
          headers: {
            Authorization: 'Bearer ' + this.state.accessToken
          }
        });

      return response;
    });

    const recommendedTracks = await Promise.all(promises);
    
    var ret = recommendedTracks.flatMap(val => val.data.tracks).map(val => val.id);
    ret = [...new Set(ret)];

    this.setState({
      recommendedTracks: ret
    });

    this.generatePlaylist();
    return ret;
  }

  async generatePlaylist() {
    if(!this.state.accessToken) {
      return false;
    }

    const user = 
      await Axios.get('https://api.spotify.com/v1/me',
        {headers: {
          Authorization: 'Bearer ' + this.state.accessToken
        }
      });

    let userId = user.data.id;

    let params = {
      name: 'Melofy Playlist!'
    };

    let config = {
      headers: {
        Authorization: 'Bearer ' + this.state.accessToken
      }
    };

    const response =
      await Axios.post(`https://api.spotify.com/v1/users/${userId}/playlists`, params, config);

    console.log(playlist);
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
          <button onClick={() => this.recommendations()}>Generate</button>
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
      accessToken: undefined,
      browserHistory: createBrowserHistory()
    }

    if(!props.cookies.get('codeVerifier') || !hash.code) {
      props.cookies.set('codeVerifier', makeVerifier(43, 128), {path: '/'});
    }
  }

  async componentDidMount() {
    const hashed = await makeChallenge(this.props.cookies.get('codeVerifier'));
    this.setState({
      challenge: hashed
    });

    if(hash.code && !this.state.accessToken) {
      const params = {
        client_id: this.state.clientId,
        grant_type: 'authorization_code',
        code: hash.code,
        redirect_uri: redirectUri,
        code_verifier: this.props.cookies.get('codeVerifier')
      };

      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }

      try {
        const response = await Axios.post('https://accounts.spotify.com/api/token', qs.stringify(params), config);

        this.setState({
          accessToken: response.data.access_token
        });
      } catch(error) {
        this.state.browserHistory.push('/');
      }

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
            : <LoginButton clientId={this.state.clientId} challenge={this.state.challenge} />}
        </div>
      </div>
    );
  }
}

export default withCookies(App);
