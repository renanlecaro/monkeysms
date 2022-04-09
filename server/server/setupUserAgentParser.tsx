import DeviceDetector from "device-detector-js";

const deviceDetector = new DeviceDetector();

export function setupUserAgentParser(app) {
  app.get("/user_agent", (req, res) => {
    const ua = deviceDetector.parse(req.get("User-Agent"));

    res.status(200).json(ua);
  });
}
