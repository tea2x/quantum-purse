import React from "react";
import { Link } from "react-router-dom";

const Navigation: React.FC = () => {
  return (
    <nav>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/home1">Home 1</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navigation; 