import { WebApp } from "meteor/webapp";
import express from "express";
import { setupAPI } from "./setupAPI";
import { setupUserAgentParser } from "./setupUserAgentParser";

const app = express();

setupAPI(app);

setupUserAgentParser(app);


app.get('/sw-messages-notifications.js', (req,res)=>{
    // This is just to avoid inlining the public key in the service worker script.
    Assets.getText("sw-messages-notifications.js", text=>{

        res.setHeader('Content-Type', 'application/javascript');
        res.end(
            'const applicationServerPublicKey ='+
            JSON.stringify(  Meteor.settings.public.push_public_key)
            +';\n'
            +text
        )

    })
})

WebApp.connectHandlers.use(app);
