import { Observable } from "../../../Framework/Knockout/knockout"
import { PageOption, ResolveURLData } from "../../../WebCore/Contracts/PageOption"

// When true, the page tree is being rebuilt to match an already-changed URL
// (e.g. a back/forward navigation), so we must not push new history entries.
let reloadMode = false
export const SetReloadMode = (value : boolean) => { reloadMode = value }

export const UpdateHistoryAndPage = async <ResolveType = void>(
    currentPage : Observable<IPartialViewModel<IHTMLInjectable<ResolveType, ResolveURLData<ResolveType>>>>,
    urlData : ResolveURLData<ResolveType>,
    selectedOption? : PageOption<ResolveType, ResolveURLData<ResolveType>>
) => {
    if (selectedOption === undefined) throw "Invalid url state!"

    const oldURL = (history.state != null)? history.state : ""
    // if (oldURL != typeof String) throw "history state not string!"

    const newURL = oldURL as String + `/${selectedOption.pageKey}`

    if (reloadMode) history.replaceState(newURL, newURL, newURL)
    else history.pushState(newURL, newURL, newURL)

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