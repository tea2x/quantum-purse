import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Home1 from "./pages/Home1";
import Navigation from "./components/Navigation";

// Detect if running on Github Pages
const isGithubPages = window.location.hostname.includes("github.io");
const repoName = isGithubPages ? window.location.pathname.split("/")[1] : "";
const basename = isGithubPages ? `/${repoName}` : "/";

const App: React.FC = () => {
  return (
    <Router basename={basename}>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home1" element={<Home1 />} />
      </Routes>
    </Router>
  );
};

export default App;
