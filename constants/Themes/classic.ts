import * as Colors from '@tamagui/colors'
import { createThemes, defaultComponentThemes } from '@tamagui/theme-builder'

const darkPalette = ['hsla(34, 63%, 9%, 1)','hsla(34, 63%, 14%, 1)','hsla(34, 63%, 18%, 1)','hsla(34, 63%, 23%, 1)','hsla(34, 63%, 27%, 1)','hsla(34, 63%, 32%, 1)','hsla(34, 63%, 36%, 1)','hsla(34, 63%, 41%, 1)','hsla(34, 63%, 45%, 1)','hsla(34, 63%, 50%, 1)','hsla(34, 63%, 93%, 1)','hsla(34, 63%, 89%, 1)']
const lightPalette = ['hsla(34, 63%, 75%, 1)','hsla(34, 63%, 69%, 1)','hsla(34, 63%, 63%, 1)','hsla(34, 63%, 57%, 1)','hsla(34, 63%, 51%, 1)','hsla(34, 63%, 46%, 1)','hsla(34, 63%, 40%, 1)','hsla(34, 63%, 34%, 1)','hsla(34, 63%, 28%, 1)','hsla(34, 63%, 22%, 1)','hsla(34, 63%, 15%, 1)','hsla(34, 63%, 1%, 1)']

const lightShadows = {
  shadow1: 'rgba(0,0,0,0.04)',
  shadow2: 'rgba(0,0,0,0.08)',
  shadow3: 'rgba(0,0,0,0.16)',
  shadow4: 'rgba(0,0,0,0.24)',
  shadow5: 'rgba(0,0,0,0.32)',
  shadow6: 'rgba(0,0,0,0.4)',
}

const darkShadows = {
  shadow1: 'rgba(0,0,0,0.2)',
  shadow2: 'rgba(0,0,0,0.3)',
  shadow3: 'rgba(0,0,0,0.4)',
  shadow4: 'rgba(0,0,0,0.5)',
  shadow5: 'rgba(0,0,0,0.6)',
  shadow6: 'rgba(0,0,0,0.7)',
}

const supplementaryColors = {
  destructive: '#dc3545',
  destructiveBoarder: '#c82333',
  destructiveText: '#F5E6D3',
  destructiveDisabled: '#6c757d',
}

// we're adding some example sub-themes for you to show how they are done, "success" "warning", "error":

const builtThemes = createThemes({
  componentThemes: defaultComponentThemes,

  base: {
    palette: {
      dark: darkPalette,
      light: lightPalette,
    },

    extra: {
      light: {
        ...Colors.green,
        ...Colors.red,
        ...Colors.yellow,
        ...lightShadows,
        ...supplementaryColors,
        shadowColor: lightShadows.shadow1,
      },
      dark: {
        ...Colors.greenDark,
        ...Colors.redDark,
        ...Colors.yellowDark,
        ...darkShadows,
        ...supplementaryColors,
        shadowColor: darkShadows.shadow1,
      },
    },
  },

  accent: {
    palette: {
      dark: ['hsla(49, 45%, 32%, 1)','hsla(49, 45%, 35%, 1)','hsla(49, 45%, 38%, 1)','hsla(49, 45%, 41%, 1)','hsla(49, 45%, 44%, 1)','hsla(49, 45%, 48%, 1)','hsla(49, 45%, 51%, 1)','hsla(49, 45%, 54%, 1)','hsla(49, 45%, 57%, 1)','hsla(49, 45%, 60%, 1)','hsla(250, 50%, 90%, 1)','hsla(226, 92%, 95%, 1)'],
      light: ['hsla(49, 45%, 42%, 1)','hsla(49, 45%, 45%, 1)','hsla(49, 45%, 47%, 1)','hsla(49, 45%, 50%, 1)','hsla(49, 45%, 52%, 1)','hsla(49, 45%, 55%, 1)','hsla(49, 45%, 57%, 1)','hsla(49, 45%, 60%, 1)','hsla(49, 45%, 62%, 1)','hsla(49, 45%, 65%, 1)','hsla(250, 50%, 95%, 1)','hsla(226, 92%, 95%, 1)'],
    },
  },

  childrenThemes: {
    warning: {
      palette: {
        dark: Object.values(Colors.yellowDark),
        light: Object.values(Colors.yellow),
      },
    },

    error: {
      palette: {
        dark: Object.values('#dc3545'),
        light: Object.values('#dc3545'),
      },
    },

    success: {
      palette: {
        dark: Object.values(Colors.greenDark),
        light: Object.values(Colors.green),
      },
    },
  },

  // optionally add more, can pass palette or template

  // grandChildrenThemes: {
  //   alt1: {
  //     template: 'alt1',
  //   },
  //   alt2: {
  //     template: 'alt2',
  //   },
  //   surface1: {
  //     template: 'surface1',
  //   },
  //   surface2: {
  //     template: 'surface2',
  //   },
  //   surface3: {
  //     template: 'surface3',
  //   },
  // },
})

export type Themes = typeof builtThemes

// the process.env conditional here is optional but saves web client-side bundle
// size by leaving out themes JS. tamagui automatically hydrates themes from CSS
// back into JS for you, and the bundler plugins set TAMAGUI_ENVIRONMENT. so
// long as you are using the Vite, Next, Webpack plugins this should just work,
// but if not you can just export builtThemes directly as themes:
export const themes: Themes =
  process.env.TAMAGUI_ENVIRONMENT === 'client' &&
  process.env.NODE_ENV === 'production'
    ? ({} as any)
    : (builtThemes as any)
