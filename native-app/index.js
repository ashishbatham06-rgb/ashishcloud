import "react-native-url-polyfill/auto";
import { registerRootComponent } from "expo";
import "./src/backup"; // registers background task at startup
import App from "./App";

registerRootComponent(App);
