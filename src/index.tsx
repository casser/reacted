import * as React from "./preact";
import { render } from "./preact";
import { Component } from "./preact";

class Hello extends Component<{ grish: string }> {
  render() {
    console.info(this);
    return <div>Mello</div>;
  }
}

function Other(this: any, props: any) {
  console.info(this);
  return <div>#{props.children}#</div>;
}

const styles = {
  fontFamily: "sans-serif",
  textAlign: "center"
};

const App = () => (
  <div style={styles}>
    <Hello grish={"Hello"}>
      <a>Hello</a>
      Hello World
      <a>Hello</a>
    </Hello>
    <Other hehe="Hello">One{"Hello"}Two</Other>
    <h2>Start Application</h2>
  </div>
);

const root = document.getElementById("root");
if (root) {
  render(<App />, root);
}
