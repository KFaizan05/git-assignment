LabelWise

Team Members:
- Faizan Kalam, Jenny Tran, Keshav Ravi, Naomi Shah, Janhavi Joshi

Project Description:

LabelWise is a mobile application designed to help users instantly 
determine whether packaged food items are safe based on their dietary 
preferences and restrictions. The app scans product ingredient lists and 
uses OCR (Optical Character Recognition) to analyze ingredient lists and 
identifies whether the item is safe, unsafe or requires caution. 

Additionally, LabelWise provides personalized alternative product 
suggestions and includes an AI-powered chatbot that generates customized 
recipes based on users’ dietary preferences and previously verified safe 
foods. 

This app aims to eliminate the frustration and uncertainty of reading 
complex ingredient labels, especially for individuals with allergies, 
dietary restrictions, or ethical food preferences. 

# LabelWise - Firebase Setup

## 1. Create a Firebase project

Create a project in [Firebase Console](https://console.firebase.google.com/), then enable:
- **Authentication** -> Sign-in providers -> **Email/Password** and **Anonymous**
- **Firestore Database** (production or test mode based on your needs)

## 2. Add your web app config

Open `frontend/js/firebase-config.js` and replace placeholder values with your
project credentials from Firebase Console -> Project settings -> Your apps.

## 3. Run the frontend

Open `frontend/html/LoginPage.html` (or your local hosted URL for this folder).
All login/profile/scan data is stored in Firebase Auth + Firestore.

# Legacy Local Stack (MySQL + PHP)

## 1. Install XAMPP

Download XAMPP from <https://www.apachefriends.org/> and run the installer
with the default options (Apache, MySQL, PHP, phpMyAdmin all ticked).

Start the XAMPP Control Panel and click **Start** next to **Apache** and
**MySQL**.

## 2. Drop the project into `htdocs`

XAMPP serves files out of `C:\xampp\htdocs\`.
Create a symlink to the folder(s):
  ```cmd
  mklink /D "C:\xampp\htdocs\labelwise" "C:\Users\<name>\git-assignment"
  ```

"C:\Users\<name>\git-assignment" can be replaceable with wherever the downloaded files are.
When it succeeds, you should see all the folders when you go into "C:\xampp\htdocs\labelwise"

## 3. Create the database

Open <http://localhost/phpmyadmin/> in your browser. Click the **SQL** tab,
paste the contents of `sql/labelwise_createSchema.sql`, and press **Go**. You
should see `labelwise` appear in the left sidebar with six tables:
`accounts`, `profiles`, `account_dietary`, `account_allergens`,
`account_custom_allergens`, and `scans`.

If phpMyAdmin is giving an error, you may need to download mySQL from <https://www.mysql.com/downloads/>. Follow a setup guide then reclick **Start** so that MySQL is highlighted green in XAMPP.

## 5. Open the app

Paste <http://localhost/LabelWise/frontend/html/LoginPage.html> into the browser.

**Create an account via Sign Up**, or click **Quick Start** on the Login page
for a temporary guest account that gets purged after logging out.
