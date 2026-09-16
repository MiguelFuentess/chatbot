import React from "react"
import { BrowserRouter as Router, Routes, Route} from "react-router-dom"
import Home from "./Pages/home"
import Chat from "./Pages/chat"
import AddQuestion from "./components/addquestions"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element = {<Home />}/>
        <Route path="/chat" element = {<Chat />}/>
        <Route path="/add" element = {<AddQuestion />}/>
      </Routes>
    </Router>
  );
}

export default App;
