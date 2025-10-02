# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Deployment to GitHub Pages

This app is configured to deploy to GitHub Pages. You have two deployment options:

### Option 1: Manual Deployment

Run the following commands to deploy manually:

```bash
# Build and deploy in one step
npm run deploy

# Or build first, then deploy
npm run predeploy
npm run deploy
```

### Option 2: Automatic Deployment (Recommended)

The app will automatically deploy to GitHub Pages when you push to the `main` branch, thanks to the GitHub Actions workflow.

**Important Setup Steps:**

1. Go to your GitHub repository settings
2. Navigate to "Pages" in the sidebar
3. Under "Source", select "GitHub Actions"
4. Push your changes to the `main` branch

Your app will be available at: `https://snowmnason.github.io/dnd-toolkit`

### Development Deployment

To deploy to a development branch:

```bash
npm run deploy-dev
```

This will deploy to the `gh-pages-dev` branch, which you can configure as a separate GitHub Pages environment for testing.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
