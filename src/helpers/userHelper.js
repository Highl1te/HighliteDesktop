/* 
    The idea behind this script is to provide the ability to remember usernames and passwords for various different user accounts.

    We accomplish this by converting the username input to a dropdown menu (with an other option) that allows user text input but is otherwise filled with "saved" usernames.
    The password input is always a text input, but it is filled with the password for the selected username.
    If the user selects "other", they can type in a new username and password, which will be saved for future use.

    The script also injects a new button that must be clicked to save the new username and password.
*/

import { setTitle } from "./titlebarHelpers";

const { ipcRenderer } = require('electron');


let doOncePerLoginScreen = true;
export function createUserHelper() {
    // Setup mutation observer on document to wait for #login-menu-username to be available
    const observer = new MutationObserver((mutations) => {
        const usernameInput = document.querySelector("#login-menu-username");
        if (usernameInput) {
            setupUserHelper();
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}


function setupUserHelper() {
    if (!doOncePerLoginScreen) return; // Prevent multiple setups
    doOncePerLoginScreen = false; // Set to false to prevent further setups
    // Identify login-menu-settings-container and add a new button to "Remember Account"
    // Button classes: login-menu-checkbox-button login-screen-bold-text login-screen-default-text-shadow
    // Button classes when checked: login-menu-checkbox-button login-screen-bold-text login-screen-default-text-shadow login-menu-checkbox-button__checked
    const settingsContainer = document.querySelector("#login-menu-settings-container");
    if (settingsContainer) {
        const rememberMeCheckbox = document.createElement("button");
        rememberMeCheckbox.id = "rememberMeCheckbox";
        rememberMeCheckbox.className = "login-menu-checkbox-button login-screen-bold-text login-screen-default-text-shadow";

        const rememberMeLabel = document.createElement("label");
        // Label classes: login-screen-small-text login-screen-default-text-shadow
        rememberMeLabel.className = "login-screen-small-text login-screen-default-text-shadow";
        rememberMeLabel.textContent = "Remember Me";
        rememberMeLabel.setAttribute("for", "rememberMeCheckbox");


        // Add click event to toggle the checkbox state
        rememberMeCheckbox.addEventListener("click", function() {
            if (rememberMeCheckbox.classList.contains("login-menu-checkbox-button__checked")) {
                rememberMeCheckbox.classList.remove("login-menu-checkbox-button__checked");
                rememberMeCheckbox.textContent = ""; // Remove checkmark when unchecked
            } else {
                rememberMeCheckbox.classList.add("login-menu-checkbox-button__checked");
                rememberMeCheckbox.textContent = "✓"; // Add checkmark when checked
            }
        });

        // Append the checkbox and label to the settings container
        settingsContainer.appendChild(rememberMeCheckbox);
        settingsContainer.appendChild(rememberMeLabel);
    }

    // Create a new div to house the home button
    const homeButtonContainer = document.createElement("div");

    // Move the home button to the new container
    const homeButton = document.querySelector("#login-menu-home-button");
    if (homeButton) {
        homeButtonContainer.appendChild(homeButton);
    }

    // Create new button to delete saved credentials
    const deleteCredentialsButton = document.createElement("button");
    deleteCredentialsButton.id = "login-menu-home-button";
    deleteCredentialsButton.className = "login-screen-bold-text login-screen-default-text-shadow";
    deleteCredentialsButton.textContent = "Delete Selected Credential";
    deleteCredentialsButton.style.color = "red"; // Make the button text red

    deleteCredentialsButton.addEventListener("click", function() {
        const selectedUsername = usernameDropdown.value;
        if (selectedUsername !== "other") {
            // If "Other" is not selected, delete the saved credential
            ipcRenderer.invoke("delete-username-password", selectedUsername, "").then(() => {
                // Remove the username from the dropdown
                const optionToRemove = Array.from(usernameDropdown.options).find(option => option.value === selectedUsername);
                if (optionToRemove) {
                    usernameDropdown.removeChild(optionToRemove);
                }
                // Clear the password input
                const passwordInput = document.querySelector("#login-menu-password");
                passwordInput.value = "";
            });
        }
    });

    homeButtonContainer.appendChild(deleteCredentialsButton);

    // Insert the home button container after the settings container
    const settingsContainerParent = settingsContainer.parentNode;
    settingsContainerParent.insertBefore(homeButtonContainer, settingsContainer.nextSibling);

    // Modify the username input to be a dropdown
    const usernameInput = document.querySelector("#login-menu-username");
    usernameInput.style.display = "none"; // Hide the original input

    const usernameDropdown = document.createElement("select");
    usernameDropdown.id = "usernameDropdown";   
    usernameDropdown.style.height = "2rem";
    usernameDropdown.style.margin = ".1rem 0 .4rem 0";
    usernameDropdown.style.minHeight = "2rem";
    usernameDropdown.style.borderRadius = "1rem";
    usernameDropdown.style.width = '-webkit-fill-available';

    // Create a div to place both the dropdown and the original input
    const dropdownContainer = document.createElement("div");
    dropdownContainer.style.display = "flex";
    dropdownContainer.style.flexDirection = "column";
    dropdownContainer.style.width = "-webkit-fill-available"; // Ensure it takes full width
    usernameInput.parentNode.insertBefore(dropdownContainer, usernameInput);

    // Insert the dropdown into the container
    dropdownContainer.appendChild(usernameDropdown);
    dropdownContainer.appendChild(usernameInput);

    // Insert the container before the original username input


    // Request IPC to get saved usernames
    ipcRenderer.invoke("get-saved-usernames").then((savedUsernames) => {
        // Populate the dropdown with saved usernames
        savedUsernames.forEach(username => {
            const option = document.createElement("option");
            option.value = username;
            option.textContent = username;
            usernameDropdown.appendChild(option);
        });
    });

    // Add an "Other" option for custom input
    const otherOption = document.createElement("option");
    otherOption.value = "other";
    otherOption.textContent = "Other";
    usernameDropdown.appendChild(otherOption);

    // Insert the dropdown before the original username input
    usernameInput.parentNode.insertBefore(usernameDropdown, usernameInput);
    
    usernameDropdown.addEventListener("change", function() {
        if (this.value === "other") {
            // If "Other" is selected, show the original input
            usernameInput.style.display = "unset";
            usernameInput.value = ""; // Clear the input for new entry
            const passwordInput = document.querySelector("#login-menu-password");
            passwordInput.value = ""; // Clear the password input
            passwordInput.disabled = false; // Enable the password input for new entry


            // See if "Delete Selected Credential" button exists
            // Query all elements with the id "login-menu-home-button"
            const potentialButtons = document.querySelectorAll("#login-menu-home-button");
            const deleteCredentialsButton = Array.from(potentialButtons).find(button => button.textContent.trim() === "Delete Selected Credential");


            if (deleteCredentialsButton) {
                deleteCredentialsButton.style.display = "none"; // Hide the delete button when entering a new username
            }

        } else {
            // Otherwise, hide the original input and fill it with the selected username
            usernameInput.style.display = "none";
            usernameInput.value = this.value;

            setTitle(`HighLite - ${this.value}`);

            // IPC Request to get saved passwords for the selected username
            ipcRenderer.invoke("get-saved-password", this.value).then((savedPassword) => {
                const passwordInput = document.querySelector("#login-menu-password");
                passwordInput.value = savedPassword || ""; // Fill with saved password or empty if not found
            })

                        // See if "Delete Selected Credential" button exists
            // Query all elements with the id "login-menu-home-button"
            const potentialButtons = document.querySelectorAll("#login-menu-home-button");
            const deleteCredentialsButton = Array.from(potentialButtons).find(button => button.textContent.trim() === "Delete Selected Credential");


            if (deleteCredentialsButton) {
                deleteCredentialsButton.style.display = "unset"; // Hide the delete button when entering a new username
            }
        }
    });


    // Set the default selected option to be Other  
    usernameDropdown.value = "other";
    usernameDropdown.dispatchEvent(new Event("change"));
    

    // When login button is clicked, save the username and password
    const loginButtons = document.getElementsByClassName("login-menu-button");
    
    // Get the button with the text "Login"
    const loginButton = Array.from(loginButtons).find(button => button.textContent.trim() === "Login");

    if (loginButton) {
        loginButton.addEventListener("click", function() {
            const selectedUsername = usernameDropdown.value;
            const passwordInput = document.querySelector("#login-menu-password");
            const password = passwordInput.value;

            // If "Remember Me" is checked, save the username and password
            const rememberMeCheckbox = document.querySelector("#rememberMeCheckbox");
            if (!rememberMeCheckbox) {
                console.error("Remember Me checkbox not found. Please ensure it is created before the login button.");
                return;
            }
            // Check if the checkbox is checked
            const rememberMeChecked = rememberMeCheckbox.classList.contains("login-menu-checkbox-button__checked");
            if (rememberMeCheckbox && rememberMeChecked) {
                if (selectedUsername === "other" && usernameInput.value !== "") {
                    // If "Other" is selected, use the value from the original input
                    ipcRenderer.invoke("save-username-password", usernameInput.value, password);
                } else {
                    // Otherwise, use the selected username from the dropdown
                    ipcRenderer.invoke("save-username-password", selectedUsername, password);
                }
            }

            // Look for 'id' hs-screen-mask to exist trigger once
            const screenMaskObserver = new MutationObserver((mutations) => {
                const screenMask = document.querySelector("#hs-screen-mask");
                if (screenMask) {
                    // Disconnect the observer once the screen mask is found
                    screenMaskObserver.disconnect();
                    doOncePerLoginScreen = true; // Reset the flag for future login screens
                }
            });
            // Start observing the document for changes
            screenMaskObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

        });
    }

    // Get password input
    const passwordInput = document.querySelector("#login-menu-password");

    // When use press the "Enter" key, trigger the login button click
    passwordInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent default form submission
            if (loginButton) {
                loginButton.click(); // Trigger the login button click
            }
        }
    });

}
