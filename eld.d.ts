declare module "eld" {
  export const eld = {
    detect(text: string): {
      language: string;
      getScores(): Record<string, number>;
      isReliable(): boolean;
    }
  };
}

/*
https://www.npmjs.com/package/eld

console.log( eld.detect('Hola, cómo te llamas?') )
// { language: 'es', getScores(): {'es': 0.5, 'et': 0.2}, isReliable(): true }
// returns { language: string, getScores(): Object, isReliable(): boolean } 
*/
