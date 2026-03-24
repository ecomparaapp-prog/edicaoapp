const React = require("react");
const { View } = require("react-native");

function MapView({ children, style }) {
  return React.createElement(View, { style }, children);
}

function Marker() {
  return null;
}

function Polyline() {
  return null;
}

function Circle() {
  return null;
}

MapView.Animated = MapView;

const PROVIDER_GOOGLE = "google";
const PROVIDER_DEFAULT = null;

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.Polyline = Polyline;
module.exports.Circle = Circle;
module.exports.PROVIDER_GOOGLE = PROVIDER_GOOGLE;
module.exports.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
