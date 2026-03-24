import { Observable } from "../../Framework/Knockout/knockout"

export type ResolveURLData<ResolveType> = {
    CurrentPageObservable : Observable<IPartialViewModel<IHTMLInjectable<ResolveType, ResolveURLData<ResolveType>>>>
    URLPath : string[]
}

export type PageOption<ResolveType, InitializationType = void> = {
    FriendlyName : string, 
    PictureUrl? : string,
    Description? : string,
    pageKey : string, 
    modelConstructor : ()=>IPartialViewModel<IHTMLInjectable<ResolveType, InitializationType>>
    pageUrl? : string
}