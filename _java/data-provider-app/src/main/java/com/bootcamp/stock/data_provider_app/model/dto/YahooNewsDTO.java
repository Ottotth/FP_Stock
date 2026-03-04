package com.bootcamp.stock.data_provider_app.model.dto;

import java.util.List;
import lombok.Data;

@Data
public class YahooNewsDTO {

	private List<Object> explains;
	private Integer count;
	private List<Object> quotes;
	private List<NewsItem> news;
	private List<Object> nav;
	private List<Object> lists;
	private List<Object> researchReports;
	private List<Object> screenerFieldResults;
	private Integer totalTime;
	private Integer timeTakenForQuotes;
	private Integer timeTakenForNews;
	private Integer timeTakenForAlgowatchlist;
	private Integer timeTakenForPredefinedScreener;
	private Integer timeTakenForCrunchbase;
	private Integer timeTakenForNav;
	private Integer timeTakenForResearchReports;
	private Integer timeTakenForScreenerField;
	private Integer timeTakenForCulturalAssets;
	private Integer timeTakenForSearchLists;

	@Data
	public static class NewsItem {
		private String uuid;
		private String title;
		private String publisher;
		private String link;
		private Long providerPublishTime;
		private String type;
		private Thumbnail thumbnail;
		private List<String> relatedTickers;
	}

	@Data
	public static class Thumbnail {
		private List<Resolution> resolutions;
	}

	@Data
	public static class Resolution {
		private String url;
		private Integer width;
		private Integer height;
		private String tag;
	}
}
