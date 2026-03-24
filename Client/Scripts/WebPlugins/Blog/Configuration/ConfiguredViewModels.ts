import { PageOption, ResolveURLData } from "../../../WebCore/Contracts/PageOption.js"
import { Utility } from "../../../WebCore/Utility.js"
import { constructUnknownViewModel } from "../../../WebCore/Utility/ConfiguredViewModels.js"
import { ArticleModel } from "../ViewModels/ArticleModel.js"
import { BlogPreviewer } from "../ViewModels/BlogPreviewer.js"

export const constructHomeViewModel = ()=>{return Utility.BundleViewAndModel(new ArticleModel(
    "/BlogViews/Home.html", "Welcome To My Skunkworks!", "/Images/Blogs/jupiter.jpg", ["Where am I? Who am I?", "The Vision", "What's Cooking?", "What Drives Me"], ["General", "Welcome"], new Date(2026, 1, 22).toDateString(), "William Chenevert"))}

export const constructMinecraftProjectsViewModel = ()=>{return Utility.BundleViewAndModel(
    new ArticleModel("/BlogViews/Minecraft Projects.html", "Super Duper Smelter", "/Images/Blogs/minecraft-thumbnail.jpeg", [
        "Problem", "Attempts", "Controlling input", "Elements of the solution", "Additional Elements"
    ], ["Video Games"], new Date(2026, 1, 22).toDateString(), "William Chenevert"))
}

export const constructTasteyBabybackRibsViewModel = ()=>{return Utility.BundleViewAndModel(
    new ArticleModel("/BlogViews/Recipes/TasteyBabybackRibs.html", "Tasty Babyback Ribs", "/Images/Blogs/IMG_9781.jpeg", [
        "The Dry Rub",
        "The Braising Liquid",
        "The Finishing Glaze",
        "Instructions"
    ], ["Recipes"], new Date(2026, 2, 23).toDateString(), "William Chenevert"))}

export const constructEthicsPaperViewModel = ()=>{return Utility.BundleViewAndModel(
    new ArticleModel("/BlogViews/Papers/EthicsFinalPaper.html", "Word Policing Is Currently Broken", "/Images/Blogs/Security-Redacted-Documents.png", [
        "Introduction: Word Policing's Current Injustice",
        "Explication: Establishing the Premise of Word Context and Policing",
        "Argument: Contextless Word Policing is Unjust; Meaning Molding is the Answer",
        "Concluding Remarks",
        "References"
    ], ["Ethics", "Relationships"], new Date(2025, 11, 17).toDateString(), "William Chenevert", ">30 min"))}

export const constructSpaceEngineersViewModel = ()=>{return Utility.BundleViewAndModel(
    new ArticleModel("/BlogViews/Space Engineers Research.html", "Gravity Drive", "/Images/Blogs/Space Engineers.jpg", [
        "Premise",
        "Drive Cost",
        "Integrating the Drive with WASD",
        "Multiplayer / Scriptless Logic",
        "Engineering Tips"
    ], ["Video Games"], new Date(2026, 1, 22).toDateString(), "William Chenevert"))}

export const constructFallBehavioralInterviewsViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/FallBehavioralAndTechnicalInterviews.html", "Behavioral And Technical Interviewing", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "Why STAR method?",
        "STAR Method",
        "What do the interviewers wanna hear?",
        "STAR Method example",
        "Technical Interview",
        "Technical Interview Myths",
        "Technical Interview Example"
    ], ["Career"], new Date(2025, 9, 30).toDateString(), "William Chenevert & Manav Damaraju"))
}

export const constructFallResumeReviewViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/FallResumeReview.html", "Wells Fargo & ACM Career Resume Review", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "Capitalizing on Space",
        "Recruiter's Perspective",
        "General Tips",
        "Resume Sections",
        "Resume Review Format"
    ], ["Career"], new Date(2025, 9, 18).toDateString(), "William Chenevert"))
}

export const constructFallBridgingTheGapViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/FallBridgingTheGap.html", "Bridging The Industry Gap From College", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "01. Be lazy: understand where you need to put your effort",
        "02. Creating Self Commenting Code",
        "03. Using Tests to Exemplify Code Execution / See Breaking Changes",
        "04. Employing Abstraction / Separation of Concerns",
        "05. Simplify / Streamline Development Cycle",
        "06. Discuss code with friends / AI",
        "07. Understand your scope",
        "09. Things to do over Winter Break",
    ], ["Career"], new Date(2025, 11, 20).toDateString(), "William Chenevert"))
}

export const constructFallPersonalProjectsViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/FallPersonalProjects.html", "Personal Projects", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "Overview of Strategies",
        "Why Build Personal Projects",
        "Brainstorming & Channeling Vision",
        "Planning & Executing Vision",
    ], ["Career"], new Date(2025, 10, 23).toDateString(), "William Chenevert"))
}

export const constructFallResumeBuildingViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/FallResumeBuilding.html", "Resume Building And Applying to Jobs", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "Who is the Exec Team",
        "What Is ACM Career",
        "Define Your Focus",
        "Resume Framework",
        "Personal Projects",
        "Joining Organizations",
        "Doing Research",
        "Resume Example",
        "Resume Summary",
        "Linkedin",
        "Applying To Jobs",
        "Conclusion"
    ], ["Career"], new Date(2025, 9, 11).toDateString(), "William Chenevert"))
}

export const constructSpringInterviewPrepViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/SpringInterviewPrep.html", "Spring Interview Prep", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "GENERAL INTERVIEW TIPS",
        "LEETCODE",
        "PRACTICING INTERVIEWS",
        "MOCK INTERVIEWS FORMAT"
    ], ["Career"], new Date(2026, 1, 19).toDateString(), "William Chenevert"))
}

export const constructSpringResumeReviewsViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/SpringResumeReviews.html", "Resume Reviews with Wells Fargo, KnowledgeLake, COER", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "Understanding Your Audience",
        "Recruiters Perspective",
        "ATS Systems",
        "Thoughts from Wells Fargo",
        "Thoughts from KnowledgeLake",
        "Resume Review Format"
    ], ["Career"], new Date(2026, 1, 12).toDateString(), "William Chenevert"))
}

export const constructSpringIDEPresentationViewModel = ()=> {
    return Utility.BundleViewAndModel(new ArticleModel("/BlogViews/Presentations/SpringIDEPresentation.html", "IDE Productivity Presentation", "/Images/Blogs/pexels-tima-miroshnichenko-5439379.jpg", [
        "Why does IDEs Exist?",
        "IDEs: Basic to Sophisticated",
        "VSCode Deep-Dive: Coding",
        "VSCode Deep-Dive: Building",
        "VSCode Deep-Dive: Debugging",
        "VSCode Deep-Dive: Testing",
        "VSCode Deep-Dive: Git",
        "VSCode Deep-Dive: Extensions",
        "VSCode Deep-Dive: Example",
        "What is PyTorch",
        "PyTorch vs TensorFlow",
        "Installation and Requirements",
        "Basic Usage: Tensors",
        "Parallelization",
        "Forward Pass",
        "Backpropagation",
        "Short Demo: A Simple Neural Network",
        "Phase 1: Prerequisites"
    ], ["Career"], new Date(2026, 1, 22).toDateString(), "William Chenevert"))
}

const assemblePageOption = (articleConstructor : ()=>IPartialViewModel<ArticleModel>, Description : string): PageOption<void, ResolveURLData<void>> => { 
    const temp = articleConstructor().Model
    return {
    FriendlyName: temp.Title, 
    pageKey: temp.Title.split(" ").join("-"),
    Description: Description,
    PictureUrl: temp.pictureURL,
    modelConstructor: articleConstructor
} }

export const constructBlogPreviewViewModel = ()=>{
    const blogs = [
        assemblePageOption(constructMinecraftProjectsViewModel, "Autonomous Smelting Array Project in Minecraft"),
        assemblePageOption(constructSpaceEngineersViewModel, "Research on Gravity Drives in Space Engineers"),
        assemblePageOption(constructTasteyBabybackRibsViewModel, "Best babyback ribs recipe ever"),
        assemblePageOption(constructEthicsPaperViewModel, "Word Policing Is Currently Broken"),
        assemblePageOption(constructSpringIDEPresentationViewModel, "An IDE Productivity Presentation for ACM Career"),
        assemblePageOption(constructFallPersonalProjectsViewModel, "A Personal Projects Presentation for ACM Career"),
        assemblePageOption(constructFallBehavioralInterviewsViewModel, "A Behavioral & Technical Interviewing Presentation for ACM Career"),
        assemblePageOption(constructFallResumeReviewViewModel, "A Resume Review Workshop for ACM Career"),
        assemblePageOption(constructFallBridgingTheGapViewModel, "Bridging The Gap Between Academics and Industry"),
        assemblePageOption(constructFallResumeBuildingViewModel, "A Resume Building Workshop for ACM Career"),
        assemblePageOption(constructSpringInterviewPrepViewModel, "An Interview Prep Workshop for ACM Career"),
        assemblePageOption(constructSpringResumeReviewsViewModel, "A Spring Resume Reviews Workshop for ACM Career"),
    ]

    return Utility.BundleViewAndModel(new BlogPreviewer(blogs))
}

export const constructProjectPreviewViewModel = ()=>{
    return Utility.BundleViewAndModel(new BlogPreviewer([
        {
            FriendlyName: "Unknown", 
            pageKey: "Unknown",
            Description: "Engineered Unknown and its engine from the ground up to explore software design while incorporating other interests such as cartography, sociology, biology, and ancient world",
            PictureUrl: "/Images/Blogs/Unknown Thumbnail.png",
            modelConstructor: constructUnknownViewModel
        },
        {
            FriendlyName: "Heartbreaker Character Generator", 
            pageKey: "Heartbreaker Character Generator",
            Description: "A character generator I built for a D&D-like homebrew",
            PictureUrl: "/Images/Blogs/PF 300dpi 3inW MEN ARMIGER MERCENARY Horse Alexander Wilke.jpg",
            modelConstructor: constructHomeViewModel, // if that doesn't work
            pageUrl: "https://heartbreaker.chenevertsoftwareservices.com"
        }
    ]))
}