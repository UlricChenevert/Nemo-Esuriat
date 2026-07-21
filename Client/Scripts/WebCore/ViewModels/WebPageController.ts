import { ko } from "../../Framework/Knockout/ko.js";
import { Observable } from "../../Framework/Knockout/knockout.js";
import { PageOption, ResolveURLData } from "../Contracts/PageOption.js";
import { ClearHistory, PopHistory, SetReloadMode, UpdateHistoryAndPage } from "../../WebPlugins/Blog/Utility/History.js";
import { customEvents } from "../../WebPlugins/Blog/Configuration/Events.js";

// Controls url, current page, and navigation within SPA

export class WebPageController implements IHTMLInjectable<void> {
    readonly ViewUrl = "WebCoreViews/WebPageView.html";
    readonly LogoImagePath = "/Images/logo.png";

    isLoading: Observable<boolean>;
    HTMLandKnockoutRequestCallback : Promise<void> = Promise.resolve()
    NavigationOptions : PageOption<void, ResolveURLData<void>>[]
    CurrentPage : ko.Observable<IPartialViewModel<IHTMLInjectable<void, ResolveURLData<void>>>>
    CurrentURL : string[]
    
    constructor(NavigationOptions : PageOption<void, ResolveURLData<void>>[], public Contact : PageOption<void, ResolveURLData<void>>) {
        this.isLoading = ko.observable(true);
        this.NavigationOptions = NavigationOptions

        this.CurrentPage = ko.observable(this.NavigationOptions[0].modelConstructor())

        const url = window.location.pathname
        this.CurrentURL = url.split("/").filter((text)=>{return text != ""})

        // document.addEventListener("pageChange" as customEvents, (event) => {
        //     this.UpdatePage((event as CustomEvent).detail);
        // });
    }

    async Init () : Promise<void> {
        await this.HTMLandKnockoutRequestCallback

        // Reload the shown view model whenever the user navigates through
        // browser history (back/forward), matching the newly-active URL.
        window.addEventListener("popstate", () => { this.ResolveFromURL(true) })

        return this.ResolveFromURL(false)
    }

    // Rebuilds the page tree from the current URL. When isReload is true the URL
    // has already been changed by the browser (popstate), so history is rewritten
    // in place instead of pushing new entries.
    private async ResolveFromURL (isReload : boolean) : Promise<void> {
        
        SetReloadMode(isReload)
        const url = window.location.pathname
        this.CurrentURL = url.split("/").filter((text)=>{return text != ""})

        if (this.CurrentURL.length == 0)
            return await UpdateHistoryAndPage(this.CurrentPage, {CurrentPageObservable : this.CurrentPage, URLPath: this.CurrentURL}, this.NavigationOptions[0]).then(()=>this.isLoading(false));

        const desiredPage = this.CurrentURL.shift()

        let selectedPageOption = this.NavigationOptions.find((testOption)=>{return testOption.pageKey == desiredPage})

        if (!selectedPageOption) {
            console.warn("Page not found, redirecting to " + this.NavigationOptions[0].FriendlyName);
            selectedPageOption = this.NavigationOptions[0];
        }

        return await this.UpdatePage(selectedPageOption)
            .then(()=>SetReloadMode(false))
        
    }

    async UpdatePage (selectedOption? : PageOption<void, ResolveURLData<void>>) {
        ClearHistory()
        return UpdateHistoryAndPage(this.CurrentPage, {CurrentPageObservable : this.CurrentPage, URLPath: this.CurrentURL}, selectedOption).then(()=>this.isLoading(false));
    }
}