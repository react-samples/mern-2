import React from 'react';
import ReactDOM from 'react-dom';
import fetch from 'isomorphic-fetch';
import cookie from 'cookie';
import styles from './app.css';

class Message extends React.Component {
  constructor(){
    super()
    this.state = {
      msgs: [],
      user_id: "",
      showAlert: false,
      alertMessage: "",
      tmp_image_path: "",
      user:{},
      csrf: "",
      file: {}
    }
  }
  alertMessage(message) {
    this.setState({
      showAlert: true,
      alertMessage: message
    })
    setTimeout(()=> {
      this.setState({showAlert: false})
    },5000)
  }
  componentWillMount(){
    fetch("http://localhost:3000/messages")
      .then(res => {
        if(res.status >= 400) {
          this.alertMessage(res.status)
        }else{
          return res.json()
        }     
      })
      .then(json => {
        this.setState({msgs: json.messages})
      }) 
  }
  componentDidMount(){
    fetch("http://localhost:3000/user")
      .then(res=> {
        if(res.status >= 400) {
          this.alertMessage(res.status)
        }else{
          return res.json()
        }
      })
      .then(json => {
        this.setState({user: json.user})
      })
    fetch("http://localhost:3000/update")
      .then(res=> {
        if(res.status >= 400) {
          this.alertMessage(res.status)
        }else{
          return res.json()
        }
      })
      .then(json => {
        this.setState({csrf: json.csrf})
      })
  }
  sendMessage(){
    const { message, file, csrf } = this.state;

    let formData = new FormData()
    formData.append("message", message)
    formData.append("_csrf", csrf)
    if(file)
      formData.append("image", file)

    fetch("http://localhost:3000/update", {
        method: 'POST',
        body: formData
      })
      .then(res =>{
         if(res.status >= 400) {
           this.alertMessage(res.status)
         }else{
           return res.json()
         }
      })
      .then(json =>{return true})
  }
  uploadImage(e){

    if(e.target.files.length === 0) return this.alertMessage("画像をロードできませんでした")
    this.setState({file: e.target.files[0]})
    const parse = e => {
      let f = e.target.files[0];
      let type = f.type;
      return new Promise((resolve, reject)=> {
        let reader = new FileReader();
        reader.onload = file => {
          return resolve({file: file, type:type})
        } 
        reader.onerror = e => {
          return reject(e)
        }
        reader.readAsArrayBuffer(f)
      });
    }

    parse(e).then((obj) => {
      console.log(obj);
      const { blob, type } = obj;
      let tmp_image_path = URL.createObjectURL(new Blob([blob], { type: type }))
      this.setState({blob: new Blob([blob], { type: type }), tmp_image_path: tmp_image_path})
    }).catch(e => {
      this.alertMessage("画像をロードできませんでした")
    })

  }
  renderLeftNode(msg) {
    return (
      <div key={msg._id}>
        <section className="node">
          <img src={"./cat.jpg"} className="photo_l"/>
          <div className="info_l">
            <div className="name_l">{msg.username ? msg.username : ""}</div>
            <div className="time">{msg.date}</div>
            <div className="messageBubble_l">{msg.message}</div>
          </div>
        </section>
      </div>
    );
  }
  renderRightNode(msg) {
    return (
      <div key={msg._id}>
        <section className="node">
          <img src={"./cat.jpg"} className="photo_r"/>
          <div className="info_r">
            <div className="name_r">{msg.username ? msg.username : ""}</div>
            <div className="messageBubble_r">{msg.message}</div>
            <div className="time">{msg.date}</div>
          </div>
        </section>
      </div>
    );
  }
  render(){
    const { tmp_image_path, message, msgs, user_id } = this.state;
    return (
      <div id="wrapper">
        <section id="message-board">
           {msgs.map(msg=> {
             return this.renderRightNode(msg)
             //msg.user_id === user_id ? this.renderRightNode(msg) : this.renderLeftNode(msg) 
           })}
        </section>
        <section id="input-board">
          <label htmlFor="image">
            <button className="image">image</button>
          </label>
          {tmp_image_path ? <img src={tmp_image_path} width="36" height="36"/> : ""}
          <input type="file" name="image" id="image" onChange={e=> this.uploadImage(e)}/>
          <input type="text" value={message} id="text-area" onChange={e => this.setState({message: e.target.value})}/>
          <button onClick={e => this.sendMessage(e)} id="submit-button">{"Send"}</button>
        </section>
      </div>
    );
  }
}

ReactDOM.render(  
  <Message />,
  document.getElementById("app")
)
