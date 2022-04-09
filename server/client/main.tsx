import React, { Suspense, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { render } from "react-dom";
import { App } from "../imports/ui/App";

Meteor.startup(() => {
  render(<AppWrap />, document.getElementById("react-target"));
});

function AppWrap() {
  useEffect(() => {
    document.getElementById("spinner").style.display = "none";
  }, []);
  return (
    <Suspense fallback={<Spinner />}>
      <App />
    </Suspense>
  );
}

function Spinner() {
  useEffect(() => {
    document.getElementById("spinner").style.display = "block";
    return () => {
      document.getElementById("spinner").style.display = "none";
    };
  }, []);
  return null;
}
