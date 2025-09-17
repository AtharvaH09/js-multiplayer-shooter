import { k } from "../App";
import addButton from "../UI/button";

export default function loginScene() {
    k.scene("title-screen", () => {
        k.add([
            k.text("Welcome to Tactical Shooter!", { size: 32 }),
            k.pos(k.width() / 2, 80),
            k.anchor("center"),
        ]);

        // Guest warning text (hidden initially, shown if guest selected)
        const guestWarning = k.add([
            k.text("", { width: k.width() - 40, size: 18 }),
            k.pos(k.width() / 2, k.height() - 80),
            k.anchor("center"),
            k.color(255, 0, 0),
        ]);

        // Login button
        addButton("Login", k.vec2(k.width() / 2, 200), () => {
            console.log("Go to Login Form");
            k.go("loginForm"); // TODO: implement loginForm scene
        });

        // Signup button
        addButton("Signup", k.vec2(k.width() / 2, 300), () => {
            console.log("Go to Signup Form");
            k.go("signupForm"); // TODO: implement signupForm scene
        });

        // Guest button
        addButton("Continue as \nGuest", k.vec2(k.width() / 2, 400), () => {
            guestWarning.text =
                "⚠️ Your data won't persist.\nIf you make progress later, it cannot be saved!";
            console.log("Guest mode selected");
            // You can assign a temporary guest ID and go to main menu
            k.wait(2, () => {
                k.go("mainMenu");
            });
        });
    });
}
