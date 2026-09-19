export interface Node{
    id:string  ;
    vector: number[];
    maxLayer:number;
    neighbours:Record<number, string[]>;
}