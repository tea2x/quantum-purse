import "./styles.css";
import Icon from "./icon.png";

// Add title
const text = "A quantum resistant wallet for ckb blockchain";
const $content = document.querySelector("#content");
if ($content) {
  $content.textContent = text;
}

// Add the icon
const myIcon = new Image();
myIcon.src = Icon;
document.body.appendChild(myIcon);
