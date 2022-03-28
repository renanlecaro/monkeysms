import React, { Suspense, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { render } from "react-dom";
import { App } from "/imports/ui/App";

Meteor.startup(() => {
  render(
    <Suspense fallback={<Spinner />}>
      <App />
    </Suspense>,
    document.getElementById("react-target")
  );
});

function Spinner() {
  useEffect(() => {
    document.getElementById("spinner").style.display = "block";
    return () => {
      document.getElementById("spinner").style.display = "none";
    };
  }, []);
  return null;
}
