// Naomi Shah
// Team 2 - Labelwise
// UC3: Create User Profile
// UC10: Modify Dietary Profile

// Simple user storage using localStorage

function createUser(email, password, restrictions, customIngredients) {
    let users = JSON.parse(localStorage.getItem("users")) || [];
  
    let user = {
      email: email,
      password: password,
      dietaryRestrictions: restrictions,
      customIngredients: customIngredients
    };
  
    users.push(user);
    localStorage.setItem("users", JSON.stringify(users));
  
    console.log("User created:", user);
  }
  
  function loginUser(email, password) {
    let users = JSON.parse(localStorage.getItem("users")) || [];
  
    let user = users.find(u => u.email === email && u.password === password);
  
    if (user) {
      localStorage.setItem("currentUser", JSON.stringify(user));
      console.log("Login successful");
    } else {
      console.log("Invalid login");
    }
  }
  
  function updateDietaryProfile(newRestrictions, newCustomIngredients) {
    let user = JSON.parse(localStorage.getItem("currentUser"));
  
    if (!user) {
      console.log("No user logged in");
      return;
    }
  
    user.dietaryRestrictions = newRestrictions;
    user.customIngredients = newCustomIngredients;
  
    localStorage.setItem("currentUser", JSON.stringify(user));
  
    console.log("Profile updated:", user);
  }