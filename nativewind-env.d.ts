/// <reference types="nativewind/types" />

declare module '*.css';
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}
