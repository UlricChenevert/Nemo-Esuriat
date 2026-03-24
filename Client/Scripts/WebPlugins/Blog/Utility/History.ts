import { Observable } from "../../../Framework/Knockout/knockout"
import { PageOption, ResolveURLData } from "../../../WebCore/Contracts/PageOption"

export const UpdateHistoryAndPage = async <ResolveType = void>(
    currentPage : Observable<IPartialViewModel<IHTMLInjectable<ResolveType, ResolveURLData<ResolveType>>>>, 
    urlData : ResolveURLData<ResolveType>,  
    selectedOption? : PageOption<ResolveType, ResolveURLData<ResolveType>>
) => {
    if (selectedOption === undefined) throw "Invalid url state!"

    const oldURL = (history.state != null)? history.state : ""
    // if (oldURL != typeof String) throw "history state not string!"

    const newURL = oldURL as String + `/${selectedOption.pageKey}`

    history.pushState(newURL, newURL, newURL)

    const pageViewModel = selectedOption.modelConstructor()
    currentPage(pageViewModel)
    return pageViewModel.Model.Init(urlData);
}

export const PopHistory = () => {
    const oldHistory = (history.state as String).split("/")
    oldHistory.shift()
    const newURL = oldHistory.join("/")
    history.replaceState(newURL, newURL, newURL)
}

export const ClearHistory = () => {
    history.replaceState("", "", "")
}